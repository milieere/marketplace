import { z } from "zod";

const flag = z
  .enum(["0", "1", "true", "false"])
  .default("0")
  .transform((v) => v === "1" || v === "true");

const ConfigSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(8787),
    MOCK: flag,
    MOCK_SPEED: z.coerce.number().min(0).default(1),
    NEBIUS_API_KEY: z.string().optional(),
    NEBIUS_BASE_URL: z.url().default("https://api.tokenfactory.nebius.com/v1"),
    MODEL_TEXT: z.string().default("deepseek-ai/DeepSeek-V4-Pro"),
    MODEL_TEXT_FALLBACK: z.string().default("nvidia/nemotron-3-super-120b-a12b"),
    MODEL_VISION: z.string().default("google/gemma-3-27b-it"),
    SLNG_API_KEY: z.string().optional(),
    SLNG_STT_MODEL: z.string().default("deepgram/nova:3"),
    BLOB_READ_WRITE_TOKEN: z.string().optional(),
  })
  .refine((c) => c.MOCK || Boolean(c.NEBIUS_API_KEY), {
    path: ["NEBIUS_API_KEY"],
    message: "required unless MOCK=1",
  });

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: Record<string, string | undefined>): Config {
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== ""));
  const result = ConfigSchema.safeParse(cleaned);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment:\n  ${problems.join("\n  ")}`);
  }
  return result.data;
}
