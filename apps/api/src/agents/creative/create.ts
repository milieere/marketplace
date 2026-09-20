import { readFileSync } from "node:fs";
import { z } from "zod";
import type { Artifact, Relaxation } from "@marketplace/contracts/artifact";
import type { BrandRecord, Location, Offering } from "@marketplace/contracts/brand-record";
import type { AgentEvent } from "@marketplace/contracts/events";
import type { Intent } from "@marketplace/contracts/intent";
import { checkCopy, type Issue } from "../../domain/check";
import { palette } from "../../domain/color";
import type { Candidate } from "../../domain/match";
import { rankPhotos } from "../../domain/photo";
import { describeLocal } from "../../domain/time";
import type { ArtifactStore } from "../../ports/artifact-store";
import type { Llm } from "../../ports/llm";
import type { VisualGenerator } from "../../ports/visual-generator";
import { designCard } from "./design";
import { renderCardShell } from "../../templates/card-shell";
import { cardCurrency, pickLogo, preferredOrientation, renderCard, renderImagePage } from "../../templates/card";
import { editorialLayout } from "../../templates/editorial";

const SYSTEM = readFileSync(new URL("../../prompts/create.md", import.meta.url), "utf8");

export type Pick = { record: BrandRecord; location?: Location; needIds: string[]; candidates: Candidate[] };
export type CreateContext = {
  intent: Intent;
  timezone: string;
  now: Date;
  llm: Llm;
  artifacts: ArtifactStore;
  loadAsset: (url: string) => Promise<string | undefined>;
  visuals?: VisualGenerator;
};

function copySchema(offeringIds: string[]) {
  return z.object({
    offeringIds: z.array(z.enum(offeringIds as [string, ...string[]])).min(1).max(3),
    headline: z.string().min(1),
    subline: z.string().nullish(),
    body: z.string().min(1),
    ctaLabel: z.string().min(1),
    tone: z.object({ formality: z.number().min(0).max(1), energy: z.number().min(0).max(1) }),
  });
}
type Copy = z.infer<ReturnType<typeof copySchema>>;

const clamp = (v: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, v));
const label = (value: string) => `${value === "vegan" ? "🌱 " : ""}${value[0]!.toUpperCase()}${value.slice(1).replace(/-/g, " ")}`;

function attributesOf(offerings: Offering[], location?: Location): Record<string, string[]> {
  const out: Record<string, string[]> = { ...location?.attributes };
  for (const o of offerings) for (const [k, v] of Object.entries(o.attributes)) out[k] = [...new Set([...(out[k] ?? []), ...v])];
  return out;
}

// Badges only for must-haves the chosen offers actually satisfy.
function badges(intent: Intent, pick: Pick, offerings: Offering[]): { badges: string[]; trace: Artifact["trace"][number] } {
  const attrs = new Set(Object.entries(attributesOf(offerings, pick.location)).flatMap(([k, vs]) => vs.map((v) => `${k}:${v}`)));
  const found = intent.needs
    .filter((n) => pick.needIds.includes(n.id))
    .flatMap((n) => Object.entries(n.required).flatMap(([k, vs]) => vs.filter((v) => attrs.has(`${k}:${v}`)).map((v) => ({ k, v, needId: n.id }))));
  const unique = [...new Map(found.map((f) => [`${f.k}:${f.v}`, f])).values()];
  return {
    badges: unique.map((f) => label(f.v)),
    trace: {
      element: "badges",
      drivenBy: unique.map((f) => `intent.needs[${f.needId}].required.${f.k}`),
      brandFacts: unique.map((f) =>
        pick.location?.attributes[f.k]?.includes(f.v)
          ? `locations[${pick.location.id}].attributes.${f.k}`
          : `offerings[${offerings.find((o) => o.attributes[f.k]?.includes(f.v))!.id}].attributes.${f.k}`,
      ),
    },
  };
}

function ctaUrl(pick: Pick, partySize: number | undefined): string {
  const base = pick.location?.reserveUrl ?? pick.record.brand.website;
  if (!base) return "#";
  try {
    const url = new URL(base);
    if (partySize) url.searchParams.set("party", String(partySize));
    return url.toString();
  } catch {
    return base;
  }
}

function prompt(ctx: CreateContext, pick: Pick, relaxed: Relaxation[], feedback?: { draft: Copy; issues: Issue[] }): string {
  const { intent, timezone } = ctx;
  const kit = pick.record.brandKit;
  const needs = intent.needs.filter((n) => pick.needIds.includes(n.id));
  const party = needs[0]?.party ?? intent.party;
  const headlineMax = kit.rules.flatMap((r) => (r.check?.kind === "max-length" && r.check.slot === "headline" ? [r.check.max] : []))[0];
  const input = {
    language: intent.language,
    request: intent.raw.text,
    phrases: intent.phrases,
    party,
    needs: needs.map((n) => ({ label: n.label, when: n.when && describeLocal(n.when.start, timezone), mustHave: n.required, niceToHave: n.preferred })),
    couldNotMeet: [...new Set(relaxed.map((r) => (r.constraint === "budget" ? "slightly over the stated budget" : r.constraint)))],
    brand: {
      name: pick.record.brand.name,
      voice: kit.voice.summary,
      doSay: kit.voice.doSay,
      dontSay: kit.voice.dontSay,
      samples: kit.voice.samples,
      rules: kit.rules.map((r) => r.text),
      toneRange: kit.voice.toneRange,
      headlineMaxCharacters: headlineMax,
    },
    location: pick.location && { name: pick.location.name, attributes: pick.location.attributes },
    offers: pick.candidates.map(({ offering: o }, i) => ({ id: o.id, bestFit: i === 0, name: o.name, description: o.description, conditions: o.conditions, attributes: o.attributes })),
  };
  const revision = feedback
    ? `\n\nYour previous draft broke brand rules. Fix exactly these and keep the rest:\n${feedback.issues.map((i) => `- ${i.ruleId}: ${i.message}`).join("\n")}\nPrevious draft:\n${JSON.stringify(feedback.draft)}`
    : "";
  return `Input:\n${JSON.stringify(input)}${revision}`;
}

// Nothing in the intent drives the look: it is the brand kit end to end
function designTrace(kit: BrandRecord["brandKit"]): Artifact["trace"][number] {
  const p = palette(kit);
  const family = (role: "display" | "body") => kit.typography.find((t) => t.role === role)?.family;
  return {
    element: "design",
    drivenBy: [],
    brandFacts: [
      `brandKit.typography.display=${family("display") ?? kit.typography[0]!.family}`,
      `brandKit.typography.body=${family("body") ?? kit.typography[0]!.family}`,
      `brandKit.colors.primary=${p.primary}`,
      `brandKit.colors.accent=${p.accent}`,
      `brandKit.colors.background=${p.background}`,
      ...Object.entries(kit.style).map(([k, v]) => `brandKit.style.${k}=${v}`),
    ],
  };
}

export async function* createArtifact(ctx: CreateContext, pick: Pick): AsyncGenerator<AgentEvent> {
  const { intent, llm } = ctx;
  const { record } = pick;
  const kit = record.brandKit;
  const stepId = `create-${record.brand.id}`;
  const stepLabel = `Writing for ${record.brand.name}`;
  yield { type: "step", agent: "creative", id: stepId, label: stepLabel, status: "started" };

  const schema = copySchema(pick.candidates.map((c) => c.offering.id));
  const allRelaxed = pick.candidates.flatMap((c) => c.relaxed);
  const needs = intent.needs.filter((n) => pick.needIds.includes(n.id));
  const party = needs[0]?.party ?? intent.party;

  let photo: { id: string; src: string; alt: string } | undefined;
  let photoOrientation: "landscape" | "portrait" | "square" | undefined;
  for (const candidate of rankPhotos(kit.photos, party, needs, pick.location, preferredOrientation(kit))) {
    const src = await ctx.loadAsset(candidate.url).catch(() => undefined);
    if (src) {
      photo = { id: candidate.id, src, alt: candidate.description };
      photoOrientation = candidate.orientation;
      break;
    }
  }

  const declared = pickLogo(kit);
  const logoSrc = declared && (await ctx.loadAsset(declared.url).catch(() => undefined));
  const logo = logoSrc ? { src: logoSrc } : undefined;

  const build = (copy: Copy) => {
    const chosen = pick.candidates.filter((c) => copy.offeringIds.includes(c.offering.id));
    const offerings = chosen.map((c) => c.offering);
    const { badges: badgeList, trace: badgeTrace } = badges(intent, pick, offerings);
    const slots: Artifact["slots"] = {
      headline: copy.headline,
      subline: copy.subline ?? undefined,
      body: copy.body,
      badges: badgeList,
      cta: { label: copy.ctaLabel, url: ctaUrl(pick, party?.size) },
    };
    const priceLines = offerings.map((o) => ({ offeringId: o.id, label: o.name, amount: o.price.amount, unit: o.price.unit, from: o.price.from ?? false }));
    const { html, colorPairs } = renderCard({ record, language: intent.language, slots, priceLines, currency: cardCurrency(record, priceLines), photo, logo, location: pick.location });
    const relaxed = [...new Map(chosen.flatMap((c) => c.relaxed).map((r) => [`${r.needId}:${r.constraint}`, r])).values()];
    return { chosen, offerings, slots, priceLines, html, relaxed, badgeTrace, issues: checkCopy(kit, slots, colorPairs) };
  };

  const write = (text: string) =>
    llm.structured({ step: `create:${record.brand.id}`, schema, system: SYSTEM, prompt: text }).catch((err: unknown) => {
      throw new Error(`Writing copy for ${record.brand.name} failed`, { cause: err });
    });
  let copy = await write(prompt(ctx, pick, allRelaxed));
  let result = build(copy);
  let revisions = 0;
  const blocking = (issues: Issue[]) => issues.filter((i) => i.severity === "block");
  if (blocking(result.issues).length) {
    yield { type: "revision", brandId: record.brand.id, issues: blocking(result.issues).map((i) => `${i.ruleId}: ${i.message}`) };
    copy = await write(prompt(ctx, pick, allRelaxed, { draft: copy, issues: blocking(result.issues) }));
    result = build(copy);
    revisions = 1;
  }

  const photoId = photo?.id;
  const id = `art-${intent.id.replace(/^int-/, "")}-${record.brand.id}`;
  const artifact: Artifact = {
    id,
    intentId: intent.id,
    needIds: pick.needIds,
    brandId: record.brand.id,
    locationId: pick.location?.id,
    offeringIds: result.offerings.map((o) => o.id),
    language: intent.language,
    format: "card",
    tone: { formality: clamp(copy.tone.formality, kit.voice.toneRange.formality), energy: clamp(copy.tone.energy, kit.voice.toneRange.energy) },
    slots: result.slots,
    priceLines: result.priceLines,
    photoId,
    trace: [
      { element: "headline", drivenBy: ["intent.phrases"], brandFacts: ["brandKit.voice.samples"] },
      designTrace(kit),
      result.badgeTrace,
      { element: "priceLines", drivenBy: pick.needIds.map((n) => `intent.needs[${n}]`), brandFacts: result.offerings.map((o) => `offerings[${o.id}].price`) },
      ...(photoId ? [{ element: "photo", drivenBy: ["intent.party", ...pick.needIds.map((n) => `intent.needs[${n}]`)], brandFacts: [`brandKit.photos[${photoId}].attributes`] }] : []),
    ],
    check: { passed: blocking(result.issues).length === 0, issues: result.issues },
    relaxed: result.relaxed,
    presentation: {
      brand: {
        id: record.brand.id,
        name: record.brand.name,
        summary: record.brand.summary,
      },
      kit: {
        colors: kit.colors,
        typography: kit.typography,
        logos: kit.logos,
        style: kit.style,
        voice: kit.voice,
        imagery: kit.imagery,
      },
      photo: photo && photoOrientation ? { ...photo, orientation: photoOrientation } : undefined,
      logo,
      layout: editorialLayout(kit),
    },
    htmlUrl: `/v1/artifacts/${id}`,
    createdAt: ctx.now.toISOString(),
  };
  await ctx.artifacts.put(id, result.html).catch((err: unknown) => {
    throw new Error(`Storing the ad for ${record.brand.name} failed`, { cause: err });
  });

  const detail = artifact.check.passed
    ? `Brand check passed${revisions ? ` after ${revisions} revision` : ""}`
    : `Brand check: ${blocking(result.issues).length} issue(s) left`;
  yield { type: "step", agent: "creative", id: stepId, label: stepLabel, status: "done", detail };
  yield { type: "artifact", artifact, html: result.html };

  if (ctx.visuals) {
    const visualStep = { type: "step", agent: "creative", id: `visual-${record.brand.id}`, label: `Designing the card for ${record.brand.name}` } as const;
    yield { ...visualStep, status: "started" };
    try {
      const visual = await ctx.visuals.generate({ artifact, record, intent });
      const page =
        visual.mode === "full-card"
          ? renderImagePage({ record, language: intent.language, imageUrl: visual.imageUrl, alt: artifact.slots.headline })
          : renderCardShell({
              record,
              language: intent.language,
              slots: artifact.slots,
              priceLines: result.priceLines,
              location: pick.location,
              image: visual.imageUrl,
              logo: logo?.src,
              css: (await designCard(llm, { record, artifact, location: pick.location, hasPhoto: Boolean(photo), hasLogo: Boolean(logo) })).css,
            });
      await ctx.artifacts.put(id, page).catch((err: unknown) => console.error(`card page for ${id}`, err));
      const detail = visual.mode === "full-card" ? "Generated full-card image" : "Generated composited card";
      yield { ...visualStep, status: "done", detail };
      yield { type: "visual", artifactId: artifact.id, imageUrl: visual.imageUrl, prompt: visual.prompt, mode: visual.mode, html: page };
    } catch (err) {
      console.error(err);
      const detail = err instanceof Error ? err.message : "failed";
      yield { ...visualStep, status: "failed", detail };
    }
  }
}
