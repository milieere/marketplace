import { fileURLToPath } from "node:url";
import { createJsonBrandRepository } from "./adapters/fs/json-brand-repository";
import { createMemoryArtifactStore } from "./adapters/memory/artifact-store";
import { createCreativeAgent } from "./agents/creative/creative-agent";
import type { Config } from "./config";
import type { AppDeps } from "./http/app";
import { loadRecordedStreams } from "./mock/recorded-streams";
import type { Llm } from "./ports/llm";

const DATA_DIR = fileURLToPath(new URL("../../../data", import.meta.url));

// No LLM adapter until PR 3: live mode stays 501 without one
export async function createContainer(config: Config, llm?: Llm): Promise<AppDeps> {
  if (config.MOCK) return { recorded: await loadRecordedStreams() };
  const artifacts = createMemoryArtifactStore();
  if (!llm) return { artifacts };
  const brands = await createJsonBrandRepository(DATA_DIR);
  return { agent: createCreativeAgent({ llm, brands, artifacts }), artifacts };
}
