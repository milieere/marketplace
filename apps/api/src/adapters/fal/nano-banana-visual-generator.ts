import type { Artifact } from "@marketplace/contracts/artifact";
import type { BrandRecord, Photo } from "@marketplace/contracts/brand-record";
import type { Intent } from "@marketplace/contracts/intent";
import type { GeneratedVisual, VisualGenerator, VisualMode } from "../../ports/visual-generator";
import { preferredOrientation } from "../../templates/card";
import { buildFullCardPrompt, buildScenePrompt } from "../../templates/card-prompt";
import { buildImagePrompt } from "../openai/image-visual-generator";

type Fetcher = (url: string, init: { method: "POST"; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<Response>;
type GenerateInput = { artifact: Artifact; record: BrandRecord; intent: Intent };

export type FalVisualGeneratorOptions = {
  apiKey: string;
  mode: VisualMode;
  model?: string;
  resolution?: "1K" | "2K" | "4K";
  outputFormat?: "png" | "jpeg" | "webp";
  timeoutMs?: number;
  attempts?: number;
  fetcher?: Fetcher;
};

type Plan = { path: string; prompt: string; system?: string; aspectRatio: string; imageUrls: string[] };

const DEFAULT_MODEL = "fal-ai/nano-banana";
const BACKGROUND_ASPECT: Record<Photo["orientation"], string> = { portrait: "3:4", landscape: "3:2", square: "1:1" };

// 422 refusals are non-deterministic; auth and credit are not
const RETRYABLE = /\(422\)|\(429\)|\(5\d\d\)|could not be reached|did not respond/i;

// Matches the SVG generator, so reruns look the same
function seedOf(id: string): number {
  return [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

const PLANS: Record<VisualMode, (input: GenerateInput, model: string) => Plan> = {
  scene: ({ artifact, record }, model) => {
    const built = buildScenePrompt({ artifact, record });
    return {
      path: built.referenceImages.length ? `${model}/edit` : model,
      prompt: built.prompt,
      aspectRatio: built.aspectRatio,
      imageUrls: built.referenceImages,
    };
  },
  "full-card": ({ artifact, record }, model) => {
    const built = buildFullCardPrompt({ artifact, record });
    return {
      // /edit takes reference images; bare model is text-to-image
      path: built.referenceImages.length ? `${model}/edit` : model,
      prompt: built.prompt,
      system: built.system,
      aspectRatio: built.aspectRatio,
      imageUrls: built.referenceImages,
    };
  },
  background: (input, model) => ({
    path: model,
    prompt: buildImagePrompt(input),
    aspectRatio: BACKGROUND_ASPECT[preferredOrientation(input.record.brandKit)],
    imageUrls: [],
  }),
};

type FalResponse = { images?: { url?: string }[] };

async function callFal(args: {
  apiKey: string;
  plan: Plan;
  resolution: string;
  outputFormat: string;
  timeoutMs: number;
  seed: number;
  fetcher: Fetcher;
}): Promise<string> {
  const { apiKey, plan, resolution, outputFormat, timeoutMs, seed, fetcher } = args;
  const body = {
    prompt: plan.prompt,
    ...(plan.system ? { system_prompt: plan.system } : {}),
    ...(plan.imageUrls.length ? { image_urls: plan.imageUrls } : {}),
    aspect_ratio: plan.aspectRatio,
    resolution,
    output_format: outputFormat,
    num_images: 1,
    seed,
  };

  let response: Response;
  try {
    response = await fetcher(`https://fal.run/${plan.path}`, {
      method: "POST",
      headers: { authorization: `Key ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    // Bare aborts don't say which brand died
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new Error(`fal ${plan.path} ${timedOut ? `did not respond within ${timeoutMs}ms` : "could not be reached"}`, { cause: err });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`fal ${plan.path} failed (${response.status})${detail ? `: ${detail.replace(/\s+/g, " ").trim().slice(0, 300)}` : ""}`);
  }

  const json = await (response.json() as Promise<FalResponse>).catch((err: unknown) => {
    throw new Error(`fal ${plan.path} returned a body that is not JSON`, { cause: err });
  });
  const imageUrl = json.images?.[0]?.url;
  if (!imageUrl) throw new Error(`fal ${plan.path} returned no image`);
  return imageUrl;
}

export function createFalVisualGenerator(options: FalVisualGeneratorOptions): VisualGenerator {
  const { apiKey, mode, model = DEFAULT_MODEL, resolution = "2K", outputFormat = "png", timeoutMs = 180_000, attempts = 3 } = options;
  const fetcher = options.fetcher ?? fetch;

  return {
    async generate(input): Promise<GeneratedVisual> {
      const plan = PLANS[mode](input, model);
      const brand = input.record.brand.id;
      let lastError = new Error(`fal ${plan.path} was never called`);

      for (let attempt = 0; attempt < attempts; attempt++) {
        const started = Date.now();
        try {
          // Refusal depends on the sampled image, so vary the seed
          const seed = seedOf(input.artifact.id) + attempt;
          const imageUrl = await callFal({ apiKey, plan, resolution, outputFormat, timeoutMs, fetcher, seed });
          console.info(`[visual] ${brand} ${mode} ${plan.path} ${resolution} ${Date.now() - started}ms${attempt ? ` (attempt ${attempt + 1})` : ""}`);
          return { artifactId: input.artifact.id, imageUrl, prompt: plan.prompt, mode };
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (!RETRYABLE.test(lastError.message)) throw lastError;
          console.info(`[visual] ${brand} attempt ${attempt + 1} refused after ${Date.now() - started}ms, retrying`);
        }
      }
      throw lastError;
    },
  };
}
