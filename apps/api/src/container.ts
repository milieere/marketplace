import { fileURLToPath } from "node:url";
import { createJsonBrandRepository } from "./adapters/fs/json-brand-repository";
import { createFsSourcePacks } from "./adapters/fs/source-packs";
import { createMemoryArtifactStore } from "./adapters/memory/artifact-store";
import { createAiSdkLlm } from "./adapters/nebius/ai-sdk-llm";
import { createPdfReader } from "./adapters/pdf/unpdf-reader";
import { createBrandAgent } from "./agents/brand/brand-agent";
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
  const brandAgent = createBrandAgent({ llm, brands, sources: createFsSourcePacks(`${DATA_DIR}/sources`), reader: createPdfReader() });
  return { agent: createCreativeAgent({ llm, brands, artifacts }), brandAgent, artifacts };
}
