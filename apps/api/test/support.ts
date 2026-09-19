import { AgentEvent } from "@marketplace/contracts/events";
import { join } from "node:path";
import { createJsonBrandRepository } from "../src/adapters/fs/json-brand-repository";

export const DATA_DIR = join(import.meta.dirname, "..", "..", "..", "data");
export const loadRepository = () => createJsonBrandRepository(DATA_DIR);

export function parseSse(body: string): AgentEvent[] {
  return body
    .split("\n\n")
    .map((block) => block.split("\n").find((line) => line.startsWith("data:")))
    .filter((line): line is string => Boolean(line))
    .map((line) => AgentEvent.parse(JSON.parse(line.slice("data:".length))));
}
