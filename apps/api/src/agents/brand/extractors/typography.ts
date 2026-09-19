import { z } from "zod";
import { BrandKit } from "@marketplace/contracts/brand-record";
import type { Llm } from "../../../ports/llm";
import { Cite, evidenceFor, type Finding, type Page } from "../findings";
import { fontFallback } from "../normalize";
import { ask, failed } from "./ask";

const Fonts = z.object({
  fonts: z.array(
    z.object({
      role: BrandKit.shape.typography.element.shape.role,
      family: z.string(),
      weights: z.array(z.number().int()),
      category: z.enum(["serif", "sans-serif", "monospace", "display", "script"]),
      cite: Cite,
    }),
  ),
});

export type PdfTypography = { fonts: BrandKit["typography"]; findings: Finding[] };

export async function extractTypography(llm: Llm, pages: Page[]): Promise<PdfTypography> {
  const out = await ask(llm, "typography", Fonts, "List the typefaces by role (display, heading, body) with their numeric weights and category.", pages).catch(failed("typography"));
  return {
    fonts: out.fonts.map((f) => ({ role: f.role, family: f.family, weights: f.weights, fallback: fontFallback(f.category) })),
    findings: out.fonts.map((f) => ({ field: "brandKit.typography", value: `${f.family} (${f.role})`, evidence: evidenceFor("brandKit.typography", f.cite, pages) })),
  };
}
