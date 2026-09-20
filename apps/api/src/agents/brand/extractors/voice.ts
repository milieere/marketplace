import { z } from "zod";
import type { BrandKit } from "@marketplace/contracts/brand-record";
import type { Llm } from "../../../ports/llm";
import { Cite, evidenceFor, type Finding, type Page } from "../findings";
import { grounded } from "../normalize";
import { ask, failed } from "./ask";

const Range = z.array(z.number().min(0).max(1)).length(2);
const Voice = z.object({
  summary: z.string(),
  formality: Range.describe("[min, max], 0 = casual, 1 = formal"),
  energy: Range.describe("[min, max], 0 = calm, 1 = energetic"),
  doSay: z.array(z.string()).describe("words and phrases the brand uses"),
  dontSay: z.array(z.string()).describe("words and phrases the brand avoids"),
  samples: z.array(z.string()).describe("real headlines or copy printed in the documents, verbatim"),
  cite: z.object({ summary: Cite, toneRange: Cite, doSay: Cite, dontSay: Cite, samples: Cite }),
});

export type VoiceResult = { voice: BrandKit["voice"]; findings: Finding[]; notes: string[] };

const sorted = (r: number[]) => [Math.min(r[0]!, r[1]!), Math.max(r[0]!, r[1]!)] as [number, number];

export async function extractVoice(llm: Llm, pages: Page[]): Promise<VoiceResult> {
  const out = await ask(llm, "voice", Voice, "Extract the tone of voice: summary, tone range, words to use and avoid, and verbatim example copy.", pages).catch(failed("voice"));
  // Samples become few-shot examples, so only printed ones count
  const samples = out.samples.filter((s) => pages.some((p) => grounded(p.text, s)));
  const dropped = out.samples.filter((s) => !samples.includes(s));
  const voice = { summary: out.summary, toneRange: { formality: sorted(out.formality), energy: sorted(out.energy) }, doSay: out.doSay, dontSay: out.dontSay, samples };
  const found = (field: keyof typeof out.cite, value: unknown): Finding => ({
    field: `brandKit.voice.${field}`,
    value,
    evidence: evidenceFor(`brandKit.voice.${field}`, out.cite[field], pages),
  });
  return {
    voice,
    findings: [found("summary", voice.summary), found("toneRange", voice.toneRange), found("doSay", voice.doSay), found("dontSay", voice.dontSay), found("samples", samples)],
    notes: dropped.map((s) => `Voice sample "${s}" isn't printed in the documents; left out.`),
  };
}
