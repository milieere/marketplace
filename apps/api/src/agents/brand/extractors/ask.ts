import { readFileSync } from "node:fs";
import type { z } from "zod";
import type { Llm } from "../../../ports/llm";
import { pagesPrompt, type Page } from "../findings";

const SYSTEM = readFileSync(new URL("../../../prompts/brand-extract.md", import.meta.url), "utf8");

export function ask<T>(llm: Llm, topic: string, schema: z.ZodType<T>, task: string, pages: Page[]): Promise<T> {
  return llm.structured({ step: `extract:${topic}`, schema, system: SYSTEM, prompt: `Task: ${task}\n\nPages:\n${pagesPrompt(pages)}` });
}

export function failed(topic: string) {
  return (err: unknown): never => {
    throw new Error(`Extracting ${topic} failed`, { cause: err });
  };
}
