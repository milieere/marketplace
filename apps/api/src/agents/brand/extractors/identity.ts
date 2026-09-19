import { z } from "zod";
import { Brand, BrandKit } from "@marketplace/contracts/brand-record";
import type { Llm } from "../../../ports/llm";
import { Cite, evidenceFor, type Finding, type Page } from "../findings";
import { ask, failed } from "./ask";

const Identity = z.object({
  name: z.string(),
  summary: z.string().describe("one sentence on what the brand is, in its own words"),
  languages: z.array(z.string()).describe("ISO 639-1 codes of the languages the brand communicates in"),
  website: z.string().nullable(),
  style: BrandKit.shape.style.describe("layout hints: corner radius in px, spacing, headline case, how photos are placed, decorative elements"),
  imagery: BrandKit.shape.imagery.describe("photography style and what to avoid"),
  cite: z.object({ name: Cite, summary: Cite, languages: Cite, style: Cite, imagery: Cite }),
});

export type IdentityResult = {
  brand: Omit<Brand, "id" | "industry">;
  style: BrandKit["style"];
  imagery: BrandKit["imagery"];
  findings: Finding[];
};

export async function extractIdentity(llm: Llm, pages: Page[]): Promise<IdentityResult> {
  const out = await ask(llm, "identity", Identity, "Extract the brand's name, summary, languages, website, layout style and photography guidance.", pages).catch(failed("identity"));
  const found = (field: string, value: unknown, cite: Cite): Finding => ({ field, value, evidence: evidenceFor(field, cite, pages) });
  return {
    brand: { name: out.name, summary: out.summary, languages: out.languages.map((l) => l.toLowerCase()), website: out.website ?? undefined },
    style: out.style,
    imagery: out.imagery,
    findings: [
      found("brand.name", out.name, out.cite.name),
      found("brand.summary", out.summary, out.cite.summary),
      found("brand.languages", out.languages, out.cite.languages),
      found("brandKit.style", out.style, out.cite.style),
      found("brandKit.imagery", out.imagery, out.cite.imagery),
    ],
  };
}
