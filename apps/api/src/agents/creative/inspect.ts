import { readFileSync } from "node:fs";
import { z } from "zod";
import type { Llm } from "../../ports/llm";

const SYSTEM = readFileSync(new URL("../../prompts/card-inspect.md", import.meta.url), "utf8");

export const InspectionSchema = z.object({
  ok: z.boolean(),
  defects: z.array(z.object({ kind: z.enum(["clipped", "illegible", "overlap", "missing", "empty"]), detail: z.string() })).default([]),
});
export type Inspection = z.infer<typeof InspectionSchema>;

export async function inspectCard(llm: Llm, input: { brandId: string; png: Uint8Array; strings: string[] }): Promise<Inspection> {
  return llm.structured({
    step: `inspect:${input.brandId}`,
    schema: InspectionSchema,
    system: SYSTEM,
    prompt: `These strings must all be present and readable on the card:\n${input.strings.map((s) => `- ${s}`).join("\n")}`,
    images: [{ data: input.png, mediaType: "image/png" }],
  });
}
