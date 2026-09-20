import type { NoMatch, Relaxation } from "@marketplace/contracts/artifact";
import type { BrandRecord } from "@marketplace/contracts/brand-record";
import type { AgentEvent } from "@marketplace/contracts/events";
import type { Intent } from "@marketplace/contracts/intent";
import type { GenerateRequest } from "@marketplace/contracts/requests";
import { matchNeed, type BrandMatch, type NeedMatch } from "../../domain/match";
import type { ArtifactStore } from "../../ports/artifact-store";
import type { BrandRepository } from "../../ports/brand-repository";
import type { Llm } from "../../ports/llm";
import type { Rasterizer } from "../../ports/rasterizer";
import type { VisualGenerator } from "../../ports/visual-generator";
import { renderFallback } from "../../templates/fallback";
import { createArtifact, type Pick } from "./create";
import { describeIntent, understand } from "./understand";

export type CreativeAgentDeps = { llm: Llm; brands: BrandRepository; artifacts: ArtifactStore; visuals?: VisualGenerator; rasterizer?: Rasterizer; designPasses?: number; clock?: () => Date };
export type CreativeAgent = { run(request: GenerateRequest, signal: AbortSignal): AsyncGenerator<AgentEvent> };

const MAX_ARTIFACTS = 3;
const DEFAULT_TIMEZONE = "Europe/Madrid";

const EXAMPLES: Record<string, string[]> = {
  en: ["Friday, 8 friends, two vegans, terrace, €30 each", "Romantic weekend for two, hotel and dinner, €400", "Sunday brunch with kids and grandma"],
  es: ["Viernes, 8 amigos, dos veganos, terraza, 30 € cada uno", "Fin de semana romántico para dos, hotel y cena, 400 €", "Brunch el domingo con niños y la abuela"],
};
const MESSAGES: Record<string, Record<NoMatch["reason"], string>> = {
  en: {
    "out-of-domain": "I plan evenings, meals and stays. Try one of these:",
    "no-results": "Nothing fits all of that right now. Diets, accessibility and group size are never loosened. Try one of these:",
  },
  es: {
    "out-of-domain": "Organizo cenas, salidas y estancias. Prueba con una de estas:",
    "no-results": "Ahora mismo nada encaja con todo eso. Dietas, accesibilidad y tamaño del grupo nunca se relajan. Prueba con una de estas:",
  },
};

function noMatch(house: BrandRecord, language: string, reason: NoMatch["reason"]): AgentEvent {
  const lang = MESSAGES[language] ? language : "en";
  const message = MESSAGES[lang]![reason];
  const suggestions = EXAMPLES[lang]!.map((text) => ({ label: text, patch: { change: { text } } }));
  return { type: "no-match", noMatch: { reason, message, suggestions, html: renderFallback(house, lang, message, suggestions) } };
}

// All-needs brands first (one artifact), then best per need in turn
function pickBrands(results: NeedMatch[]): Pick[] {
  const withMatches = results.filter((r) => r.matches.length);
  const byBrand = new Map<string, { needId: string; match: BrandMatch }[]>();
  for (const r of withMatches) for (const match of r.matches) byBrand.set(match.record.brand.id, [...(byBrand.get(match.record.brand.id) ?? []), { needId: r.needId, match }]);

  const toPick = (entries: { needId: string; match: BrandMatch }[]): Pick => ({
    record: entries[0]!.match.record,
    location: entries[0]!.match.location,
    needIds: entries.map((e) => e.needId),
    candidates: [...new Map(entries.flatMap((e) => e.match.offerings).map((c) => [c.offering.id, c])).values()],
  });

  const picks: Pick[] = [];
  if (withMatches.length > 1) {
    const coverAll = [...byBrand.values()]
      .filter((entries) => entries.length === withMatches.length)
      .sort((a, b) => b.reduce((s, e) => s + e.match.score, 0) - a.reduce((s, e) => s + e.match.score, 0));
    picks.push(...coverAll.slice(0, MAX_ARTIFACTS).map(toPick));
  }
  const depth = Math.max(0, ...withMatches.map((r) => r.matches.length));
  for (let i = 0; i < depth && picks.length < MAX_ARTIFACTS; i++) {
    for (const r of withMatches) {
      const match = r.matches[i];
      if (match && picks.length < MAX_ARTIFACTS && !picks.some((p) => p.record.brand.id === match.record.brand.id)) {
        picks.push(toPick([{ needId: r.needId, match }]));
      }
    }
  }
  return picks;
}

function rationale(intent: Intent, pick: Pick): string {
  const best = pick.candidates[0]!.offering;
  const must = intent.needs.filter((n) => pick.needIds.includes(n.id)).flatMap((n) => Object.values(n.required).flat());
  const relaxed = pick.candidates[0]!.relaxed.map((r) => (r.constraint === "budget" ? "a bit over budget" : `no ${r.constraint.split(":")[1]}`));
  return [best.name, must.length ? [...new Set(must)].join(", ") : undefined, ...relaxed].filter(Boolean).join(" · ");
}

function filterDetail(results: NeedMatch[], total: number): string {
  const matched = new Set(results.flatMap((r) => r.matches.map((m) => m.record.brand.id)));
  const reasons = [...new Set(results.flatMap((r) => r.excluded.map((e) => e.reason)))].slice(0, 2);
  const closest = results.some((r) => r.closest);
  return `${closest ? 0 : matched.size} match · ${total - (closest ? 0 : matched.size)} excluded${reasons.length ? ` (${reasons.join("; ")})` : ""}`;
}

async function* orFailed(gen: AsyncGenerator<AgentEvent>, pick: Pick): AsyncGenerator<AgentEvent> {
  try {
    yield* gen;
  } catch (err) {
    console.error(err);
    const detail = err instanceof Error ? err.message : "failed";
    yield { type: "step", agent: "creative", id: `create-${pick.record.brand.id}`, label: `Writing for ${pick.record.brand.name}`, status: "failed", detail };
  }
}

// Parallel creates; events stream as each brand produces them
async function* merge(gens: AsyncGenerator<AgentEvent>[]): AsyncGenerator<AgentEvent> {
  const next = (i: number) => gens[i]!.next().then((r) => ({ r, i }));
  const pending = new Map(gens.map((_, i) => [i, next(i)]));
  while (pending.size) {
    const { r, i } = await Promise.race(pending.values());
    if (r.done) pending.delete(i);
    else {
      pending.set(i, next(i));
      yield r.value;
    }
  }
}

export function createCreativeAgent({ llm, brands, artifacts, visuals, rasterizer, designPasses, clock = () => new Date() }: CreativeAgentDeps): CreativeAgent {
  return {
    async *run(request, signal) {
      const now = request.now ? new Date(request.now) : clock();
      const timezone = request.timezone ?? DEFAULT_TIMEZONE;
      const house = await brands.house();
      const vocabulary = await brands.vocabulary(house.brand.industry);
      const records = (await brands.listVerified()).filter((r) => r.brand.industry === vocabulary.industry);

      const understandStep = { type: "step", agent: "creative", id: "understand", label: "Understanding your request" } as const;
      yield { ...understandStep, status: "started" };
      const intent = await understand(llm, { text: request.text, now, timezone, vocabulary, previousIntent: request.previousIntent });
      const outOfDomain = intent.scope === "out-of-domain";
      yield { ...understandStep, status: "done", detail: outOfDomain ? "Not a hospitality request" : describeIntent(intent, timezone) };
      yield { type: "intent", intent };
      if (signal.aborted) return;
      if (outOfDomain) {
        yield noMatch(house, intent.language, "out-of-domain");
        yield { type: "done" };
        return;
      }

      const filterStep = { type: "step", agent: "creative", id: "filter", label: `Checking ${records.length} brands against your needs` } as const;
      yield { ...filterStep, status: "started" };
      const results = intent.needs.map((need) => matchNeed(intent, need, records, vocabulary));
      yield { ...filterStep, status: "done", detail: filterDetail(results, records.length) };

      const found = results.some((r) => r.matches.length);
      if (results.some((r) => r.closest)) {
        const relaxations: Relaxation[] = [
          ...new Map(
            results.flatMap((r) => r.matches.slice(0, MAX_ARTIFACTS).flatMap((m) => m.offerings.flatMap((c) => c.relaxed))).map((x) => [`${x.needId}:${x.constraint}`, x]),
          ).values(),
        ];
        if (relaxations.length) yield { type: "relaxed", relaxations };
        const close = new Set(results.flatMap((r) => r.matches.map((m) => m.record.brand.id))).size;
        yield {
          type: "step",
          agent: "creative",
          id: "filter",
          label: "Looking a little wider",
          status: "done",
          detail: found ? `${close} close match` : "Still 0 match: diets, accessibility and group size are never relaxed",
        };
      }
      if (!found) {
        yield noMatch(house, intent.language, "no-results");
        yield { type: "done" };
        return;
      }

      const rankStep = { type: "step", agent: "creative", id: "rank", label: "Picking the best fit" } as const;
      yield { ...rankStep, status: "started" };
      const picks = pickBrands(results);
      yield { ...rankStep, status: "done" };
      yield {
        type: "matches",
        brands: picks.map((p) => ({ id: p.record.brand.id, name: p.record.brand.name, needIds: p.needIds, rationale: rationale(intent, p) })),
      };
      if (signal.aborted) return;

      const ctx = { intent, timezone, now, llm, artifacts, loadAsset: brands.asset, visuals, rasterizer, designPasses };
      let produced = 0;
      for await (const event of merge(picks.map((p) => orFailed(createArtifact(ctx, p), p)))) {
        if (signal.aborted) return;
        if (event.type === "artifact") produced++;
        yield event;
      }
      if (!produced) yield { type: "error", message: "Couldn't write any ads this time. Please try again." };
      yield { type: "done" };
    },
  };
}
