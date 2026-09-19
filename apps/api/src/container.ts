import { fileURLToPath } from "node:url";
import { createJsonBrandRepository } from "./adapters/fs/json-brand-repository";
import { createMemoryArtifactStore } from "./adapters/memory/artifact-store";
import { createAiSdkLlm } from "./adapters/nebius/ai-sdk-llm";
import { createCreativeAgent } from "./agents/creative/creative-agent";
import type { Config } from "./config";
import type { AppDeps } from "./http/app";
import { loadRecordedStreams } from "./mock/recorded-streams";

const DATA_DIR = fileURLToPath(new URL("../../../data", import.meta.url));

export async function createContainer(config: Config): Promise<AppDeps> {
  if (config.MOCK) return { recorded: await loadRecordedStreams() };
  const artifacts = createMemoryArtifactStore();
  const llm = createAiSdkLlm({
    apiKey: config.NEBIUS_API_KEY!,
    baseURL: config.NEBIUS_BASE_URL,
    models: [config.MODEL_TEXT, config.MODEL_TEXT_FALLBACK],
  });
  const brands = await createJsonBrandRepository(DATA_DIR);
  return { agent: createCreativeAgent({ llm, brands, artifacts }), artifacts };
}
