import type { z } from "zod";

export type StructuredRequest<T> = {
  // e.g. "understand", "create:casa-brisa"; for logs and test fakes
  step: string;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  // Page renders or photos, for vision-capable models
  images?: { data: Uint8Array; mediaType: string }[];
};

export interface Llm {
  // Resolves only with schema-valid output
  structured<T>(request: StructuredRequest<T>): Promise<T>;
}
