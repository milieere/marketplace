import { readFileSync } from "node:fs";
import { z } from "zod";
import type { Artifact } from "@marketplace/contracts/artifact";
import type { BrandRecord, Location } from "@marketplace/contracts/brand-record";
import type { Llm } from "../../ports/llm";
import { applyCase, cardCurrency, cardDesign, currencySymbol, formatPrice } from "../../templates/card";
import { renderCardStyle, type CardTokens } from "../../templates/card-style";

const SYSTEM = readFileSync(new URL("../../prompts/card-design.md", import.meta.url), "utf8");

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const CardTokensSchema = z.object({
  idea: z.string().min(1),
  copyAnchor: z.enum(["bottom", "lower-third", "top", "centre-left", "bottom-left", "bottom-right"]),
  lockup: z.enum(["top-left", "top-right", "top-centre", "bottom-left"]),
  scrimStrength: z.enum(["light", "medium", "heavy"]),
  scrimColour: hex,
  headlineSize: z.enum(["s", "m", "l", "xl"]),
  headlineUpper: z.boolean(),
  headlineTracking: z.enum(["tight", "normal", "wide"]),
  headlineColour: hex,
  bodyColour: hex,
  accent: hex,
  priceTreatment: z.enum(["hero", "inline", "corner-mark"]),
  priceColour: hex,
  badges: z.enum(["solid", "outline", "none"]),
  rule: z.boolean(),
  align: z.enum(["left", "centre"]),
});

export type DesignInput = {
  record: BrandRecord;
  artifact: Artifact;
  location?: Location;
  hasPhoto: boolean;
  hasLogo: boolean;
};

export type Design = { idea: string; css: string; tokens: CardTokens };

export function designPrompt(input: DesignInput): string {
  const { record, artifact, location, hasPhoto, hasLogo } = input;
  const kit = record.brandKit;
  const d = cardDesign(kit);
  const currency = cardCurrency(record, artifact.priceLines);
  const line = artifact.priceLines[0];

  return JSON.stringify(
    {
      brand: { name: record.brand.name, summary: record.brand.summary },
      palette: kit.colors.map((c) => ({ id: c.id, hex: c.hex, role: c.role })),
      suggested: { deep: d.palette.deep, onDeep: d.palette.onDeep, accent: d.palette.accent, text: d.palette.text },
      typography: kit.typography.map((t) => ({ role: t.role, family: t.family })),
      style: kit.style,
      voice: { summary: kit.voice.summary, doSay: kit.voice.doSay, dontSay: kit.voice.dontSay },
      imagery: kit.imagery,
      advertising: kit.advertising ?? null,
      rules: kit.rules.map((r) => r.text),
      tone: artifact.tone,
      photo: hasPhoto ? "a photograph fills the card behind everything" : "no photograph; colour and type alone",
      mark: hasLogo ? "a logo mark sits in the lockup" : "no mark; the lockup is the brand name alone",
      copy: {
        headline: applyCase(artifact.slots.headline, kit.style.headlineCase),
        headlineCharacters: artifact.slots.headline.length,
        subline: artifact.slots.subline ?? null,
        body: kit.advertising?.shows.includes("body") ? artifact.slots.body : null,
        badges: artifact.slots.badges,
        place: location?.name ?? null,
        offer: line?.label ?? null,
        price: line ? formatPrice(line, currency, artifact.language) : null,
      },
    },
    null,
    2,
  );
}

export async function designCard(llm: Llm, input: DesignInput): Promise<Design> {
  const { idea, ...tokens } = await llm.structured({
    step: `design:${input.record.brand.id}`,
    schema: CardTokensSchema,
    system: SYSTEM,
    prompt: `Art-direct the card for this brand and this copy.\n\n${designPrompt(input)}`,
  });
  return { idea, tokens, css: renderCardStyle(input.record.brandKit, tokens) };
}
