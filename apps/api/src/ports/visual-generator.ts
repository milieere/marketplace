import type { Artifact } from "@marketplace/contracts/artifact";
import type { BrandRecord } from "@marketplace/contracts/brand-record";
import type { Intent } from "@marketplace/contracts/intent";

export type VisualMode = "full-card" | "background";

export type GeneratedVisual = {
  artifactId: string;
  imageUrl: string;
  prompt: string;
  // full-card images already contain the copy; background images sit under DOM text
  mode: VisualMode;
};

export type VisualGenerator = {
  generate(input: { artifact: Artifact; record: BrandRecord; intent: Intent }): Promise<GeneratedVisual>;
};
