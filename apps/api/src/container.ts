import { fileURLToPath } from "node:url";
import { createJsonBrandRepository } from "./adapters/fs/json-brand-repository";
import { createFsSourcePacks } from "./adapters/fs/source-packs";
import { createFalVisualGenerator } from "./adapters/fal/nano-banana-visual-generator";
import { createSvgVisualGenerator } from "./adapters/local/svg-visual-generator";
import { createMemoryArtifactStore } from "./adapters/memory/artifact-store";
import { createAiSdkLlm } from "./adapters/nebius/ai-sdk-llm";
import { createNebiusImageVisualGenerator } from "./adapters/openai/image-visual-generator";
import { createPdfReader } from "./adapters/pdf/unpdf-reader";
import { createBrandAgent } from "./agents/brand/brand-agent";
import { createCreativeAgent } from "./agents/creative/creative-agent";
import type { Config } from "./config";
import type { AppDeps } from "./http/app";
import type { VisualGenerator } from "./ports/visual-generator";
import { loadRecordedStreams } from "./mock/recorded-streams";

const DATA_DIR = fileURLToPath(new URL("../../../data", import.meta.url));

// `auto` prefers fal when a key is present. A failing provider surfaces a failed step
// rather than quietly substituting a placeholder.
function selectVisualGenerator(config: Config): VisualGenerator {
  if (config.VISUAL_PROVIDER === "fal" || (config.VISUAL_PROVIDER === "auto" && config.FAL_API_KEY)) {
    return createFalVisualGenerator({
      apiKey: config.FAL_API_KEY!,
      mode: config.VISUAL_MODE,
      model: config.FAL_MODEL,
      resolution: config.FAL_RESOLUTION,
    });
  }
  if (config.VISUAL_PROVIDER === "svg") return createSvgVisualGenerator();
  return createNebiusImageVisualGenerator({
    apiKey: config.NEBIUS_API_KEY!,
    baseURL: config.NEBIUS_IMAGE_BASE_URL ?? config.NEBIUS_BASE_URL,
    model: config.MODEL_IMAGE,
    size: config.IMAGE_SIZE,
    responseExtension: config.IMAGE_EXTENSION,
    inferenceSteps: config.IMAGE_INFERENCE_STEPS,
    seed: config.IMAGE_SEED,
  });
}

export async function createContainer(config: Config): Promise<AppDeps> {
  if (config.MOCK) return { recorded: await loadRecordedStreams() };
  const artifacts = createMemoryArtifactStore();
  const llm = createAiSdkLlm({
    apiKey: config.NEBIUS_API_KEY!,
    baseURL: config.NEBIUS_BASE_URL,
    models: [config.MODEL_TEXT, config.MODEL_TEXT_FALLBACK],
    visionModels: [config.MODEL_VISION],
  });
  const brands = await createJsonBrandRepository(DATA_DIR);
  const sources = createFsSourcePacks(`${DATA_DIR}/sources`);
  const brandAgent = createBrandAgent({ llm, brands, sources, reader: createPdfReader() });
  const visuals = selectVisualGenerator(config);
  return { agent: createCreativeAgent({ llm, brands, artifacts, visuals }), brandAgent, artifacts, brands, sources };
}
