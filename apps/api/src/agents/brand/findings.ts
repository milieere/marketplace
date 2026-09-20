import { z } from "zod";
import type { Evidence } from "@marketplace/contracts/brand-record";
import { grounded } from "./normalize";

export type Finding = { field: string; value: unknown; evidence: Evidence };
export type Page = { documentId: string; number: number; text: string };

// Below this, Verify re-asks the model
export const LOW_CONFIDENCE = 0.7;
const UNGROUNDED = 0.4;

export const Cite = z.object({
  document: z.string(),
  page: z.number().int().positive(),
  quote: z.string().describe("verbatim text copied from the page"),
  confidence: z.number().min(0).max(1),
});
export type Cite = z.infer<typeof Cite>;

// A quote missing from the cited page is searched elsewhere, else distrusted
export function evidenceFor(field: string, cite: Cite, pages: Page[]): Evidence {
  const cited = pages.find((p) => p.documentId === cite.document && p.number === cite.page);
  const page = cited && grounded(cited.text, cite.quote) ? cited : pages.find((p) => grounded(p.text, cite.quote));
  const fallback = cited ?? pages[0];
  return {
    field,
    documentId: page?.documentId ?? fallback?.documentId ?? cite.document,
    page: page?.number ?? fallback?.number,
    quote: cite.quote,
    confidence: page ? cite.confidence : Math.min(cite.confidence, UNGROUNDED),
  };
}

export function pagesPrompt(pages: Page[]): string {
  return pages.map((p) => `=== document ${p.documentId}, page ${p.number} ===\n${p.text}`).join("\n\n");
}
