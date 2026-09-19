import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, type ModelMessage } from "ai";
import { z } from "zod";
import type { Llm, StructuredRequest } from "../../ports/llm";

export type AiSdkLlmOptions = { apiKey: string; baseURL: string; models: string[]; timeoutMs?: number };

function parseJson(text: string): unknown {
  const body = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) return undefined;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

// JSON-schema mode is unreliable here: validate, retry once, then next model
export function createAiSdkLlm({ apiKey, baseURL, models, timeoutMs = 45_000 }: AiSdkLlmOptions): Llm {
  const provider = createOpenAICompatible({ name: "nebius", baseURL, apiKey });
  return {
    async structured<T>(req: StructuredRequest<T>): Promise<T> {
      const system = `${req.system}\n\nReply with one JSON object that matches this JSON Schema:\n${JSON.stringify(z.toJSONSchema(req.schema))}`;
      const images = (req.images ?? []).map((i) => ({ type: "image" as const, image: i.data, mediaType: i.mediaType }));
      const failures: string[] = [];
      for (const model of models) {
        let messages: ModelMessage[] = [{ role: "user", content: [{ type: "text", text: req.prompt }, ...images] }];
        for (let attempt = 0; attempt < 2; attempt++) {
          const started = Date.now();
          let text: string;
          try {
            ({ text } = await generateText({ model: provider(model), system, messages, temperature: 0.3, abortSignal: AbortSignal.timeout(timeoutMs) }));
          } catch (err) {
            failures.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
            break;
          }
          const parsed = req.schema.safeParse(parseJson(text));
          console.info(`[llm] ${req.step} ${model} ${Date.now() - started}ms ${parsed.success ? "ok" : "invalid"}`);
          if (parsed.success) return parsed.data;
          const problem = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
          failures.push(`${model}: ${problem}`);
          messages = [...messages, { role: "assistant", content: text }, { role: "user", content: `That reply was not valid (${problem}). Reply again with the corrected JSON object only.` }];
        }
      }
      throw new Error(`${req.step}: no valid reply from any model (${failures.join(" | ")})`);
    },
  };
}
