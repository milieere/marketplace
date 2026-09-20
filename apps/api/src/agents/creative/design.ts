import { readFileSync } from "node:fs";
import { z } from "zod";
import type { Artifact } from "@marketplace/contracts/artifact";
import type { BrandRecord, Location } from "@marketplace/contracts/brand-record";
import type { Llm } from "../../ports/llm";
import type { Rasterizer } from "../../ports/rasterizer";
import { inspectCard } from "./inspect";
import { applyCase, cardCurrency, cardDesign, currencySymbol, formatPrice } from "../../templates/card";

const SYSTEM = readFileSync(new URL("../../prompts/card-design.md", import.meta.url), "utf8");

export const CardDesignSchema = z.object({
  idea: z.string().min(1),
  css: z.string().min(1),
});
export type CardDesignResult = z.infer<typeof CardDesignSchema>;

// A stray @import or url() would phone home from a share link
const BANNED = /@import|url\s*\(|expression\s*\(|javascript:|position\s*:\s*fixed|<\/?script/i;

export function sanitizeCss(css: string): string {
  return css
    .split("\n")
    .filter((line) => !BANNED.test(line))
    .join("\n")
    .trim();
}

export type DesignInput = {
  record: BrandRecord;
  artifact: Artifact;
  location?: Location;
  hasPhoto: boolean;
  hasLogo: boolean;
};

export function designPrompt(input: DesignInput): string {
  const { record, artifact, location, hasPhoto, hasLogo } = input;
  const kit = record.brandKit;
  const d = cardDesign(kit);
  const currency = cardCurrency(record, artifact.priceLines);
  const line = artifact.priceLines[0];

  return JSON.stringify(
    {
      card: { width: 430, aspect: "3:4 portrait", radius: kit.style.radius },
      brand: { name: record.brand.name, summary: record.brand.summary },
      palette: { ...d.palette, cta: undefined },
      typography: kit.typography.map((t) => ({ role: t.role, family: t.family, weights: t.weights, fallback: t.fallback })),
      style: kit.style,
      voice: { summary: kit.voice.summary, doSay: kit.voice.doSay, dontSay: kit.voice.dontSay, samples: kit.voice.samples },
      imagery: kit.imagery,
      advertising: kit.advertising ?? null,
      rules: kit.rules.map((r) => r.text),
      tone: artifact.tone,
      photo: hasPhoto ? "a photograph is present in .media" : "no photograph; .media is empty, use colour and type alone",
      mark: hasLogo ? "a logo mark image is present in .lockup" : "no mark; .lockup has the brand name only",
      copy: {
        note: "Only the copy fields present below are in the markup. Do not style or expect the others.",
        headline: applyCase(artifact.slots.headline, kit.style.headlineCase),
        subline: artifact.slots.subline ?? null,
        body: artifact.slots.body,
        badges: artifact.slots.badges,
        place: location?.name ?? null,
        priceLevel: location?.priceLevel ? currencySymbol(currency, artifact.language).repeat(location.priceLevel) : null,
        offer: line?.label ?? null,
        price: line ? formatPrice(line, currency, artifact.language) : null,
      },
    },
    null,
    2,
  );
}

export async function designCard(llm: Llm, input: DesignInput): Promise<CardDesignResult> {
  const result = await llm.structured({
    step: `design:${input.record.brand.id}`,
    schema: CardDesignSchema,
    system: SYSTEM,
    prompt: `Design the card for this brand and this copy.\n\n${designPrompt(input)}`,
  });
  return { idea: result.idea, css: sanitizeCss(result.css) };
}

const OBJECTIVE = new Set(["clipped", "overlap", "missing", "empty"]);

export type CheckedDesign = CardDesignResult & { attempts: number; defects: string[] };

export type DesignDeps = {
  llm: Llm;
  rasterizer?: Rasterizer;
  render: (css: string) => string;
  strings: string[];
  size: { width: number; height: number };
  attempts?: number;
};

// The designer cannot see its own output, so render it and let a vision model look
export async function designCardChecked(deps: DesignDeps, input: DesignInput): Promise<CheckedDesign> {
  const { llm, rasterizer, render, strings, size, attempts = 1 } = deps;
  const design0 = await designCard(llm, input);
  let design = design0;
  let defects: string[] = [];

  // One pass by default: the design prompt carries the constraints the checker used
  // to catch, and a render-and-look round trip costs more than it returns
  if (attempts <= 1 || !rasterizer) return { ...design, attempts: 1, defects: [] };

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (!rasterizer) return { ...design, attempts: attempt, defects: [] };
    const png = await rasterizer.render(render(design.css), size);
    if (!png) return { ...design, attempts: attempt, defects: [] };

    const seen = await inspectCard(llm, { brandId: input.record.brand.id, png, strings }).catch(() => undefined);
    if (!seen || seen.ok) return { ...design, attempts: attempt, defects: [] };

    // "illegible" is a judgement call the checker gets wrong often; chasing it
    // costs a full design pass and rarely converges
    const actionable = seen.defects.filter((d) => OBJECTIVE.has(d.kind));
    defects = actionable.map((d) => `${d.kind}: ${d.detail}`);
    if (!actionable.length) return { ...design, attempts: attempt, defects: [] };
    if (attempt === attempts) break;
    design = await repairCard(llm, input, design, defects);
  }
  return { ...design, attempts, defects };
}

async function repairCard(llm: Llm, input: DesignInput, previous: CardDesignResult, defects: string[]): Promise<CardDesignResult> {
  const result = await llm.structured({
    step: `repair:${input.record.brand.id}`,
    schema: CardDesignSchema,
    system: SYSTEM,
    prompt: `Design the card for this brand and this copy.

${designPrompt(input)}

Your previous stylesheet rendered with these defects. Fix every one and change nothing else about the design:
${defects.map((d) => `- ${d}`).join("\n")}

Previous stylesheet:
${previous.css}`,
  });
  return { idea: previous.idea, css: sanitizeCss(result.css) };
}
