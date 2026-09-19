import { readFileSync } from "node:fs";
import { z } from "zod";
import type { Llm } from "../../ports/llm";
import { Cite, evidenceFor, LOW_CONFIDENCE, pagesPrompt, type Finding, type Page } from "./findings";

const key = (f: Finding) => `${f.field}|${f.evidence.quote ?? ""}`;

const SYSTEM = readFileSync(new URL("../../prompts/brand-verify.md", import.meta.url), "utf8");
const MAX_CHECKS = 6;

const Check = z.object({ supported: z.boolean(), cite: Cite.nullable(), note: z.string() });

export type Verified = { findings: Finding[]; notes: string[]; checked: number };

// One re-ask round; still doubtful means human review
export async function verify(llm: Llm, findings: Finding[], pages: Page[]): Promise<Verified> {
  const onPages = new Set(pages.map((p) => p.documentId));
  const doubtful = [...new Map(findings.filter((f) => f.evidence.confidence < LOW_CONFIDENCE && onPages.has(f.evidence.documentId)).map((f) => [key(f), f])).values()];
  const toCheck = doubtful.slice(0, MAX_CHECKS);
  const notes = doubtful.slice(MAX_CHECKS).map((f) => `${f.field}: low confidence, not double-checked.`);

  const results = await Promise.all(
    toCheck.map(async (f) => {
      const prompt = `Field: ${f.field}\nExtracted value: ${JSON.stringify(f.value)}\nQuote given: ${JSON.stringify(f.evidence.quote ?? null)}\n\nPages:\n${pagesPrompt(pages)}`;
      const check = await llm.structured({ step: `verify:${f.field}`, schema: Check, system: SYSTEM, prompt }).catch(() => undefined);
      const evidence = check?.supported && check.cite ? evidenceFor(f.field, check.cite, pages) : undefined;
      return { f, evidence: evidence && evidence.confidence >= LOW_CONFIDENCE ? evidence : undefined, note: check?.note };
    }),
  );

  const confirmed = new Map(results.flatMap((r) => (r.evidence ? [[key(r.f), r.evidence] as const] : [])));
  for (const r of results) if (!r.evidence) notes.push(`${r.f.field}: couldn't confirm ${JSON.stringify(r.f.value)} in the sources${r.note ? ` (${r.note})` : ""}.`);
  return {
    findings: findings.map((f) => (confirmed.has(key(f)) ? { ...f, evidence: confirmed.get(key(f))! } : f)),
    notes,
    checked: toCheck.length,
  };
}
