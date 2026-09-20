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
    NEBIUS_IMAGE_BASE_URL: z.url().default("https://api.studio.nebius.ai/v1"),
    MODEL_TEXT: z.string().default("deepseek-ai/DeepSeek-V4-Pro-0813"),
    MODEL_TEXT_FALLBACK: z.string().default("nvidia/nemotron-3-super-120b-a12b"),
    MODEL_VISION: z.string().default("google/gemma-3-27b-it"),
    MODEL_IMAGE: z.string().default("black-forest-labs/flux-schnell"),
    VISUAL_PROVIDER: z.enum(["auto", "fal", "nebius", "svg"]).default("auto"),
    VISUAL_MODE: z.enum(["scene", "full-card", "background"]).default("scene"),
    FAL_API_KEY: z.string().optional(),
    FAL_MODEL: z.string().default("fal-ai/nano-banana"),
    FAL_RESOLUTION: z.enum(["1K", "2K", "4K"]).default("2K"),
    IMAGE_SIZE: z.string().default("1024x1024"),
    IMAGE_EXTENSION: z.enum(["jpeg", "png", "webp"]).default("webp"),
    IMAGE_INFERENCE_STEPS: z.coerce.number().int().positive().default(28),
    IMAGE_SEED: z.coerce.number().int().optional(),
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
