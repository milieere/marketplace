import type { Artifact } from "@marketplace/contracts/artifact";
import type { BrandRecord } from "@marketplace/contracts/brand-record";
import type { Intent } from "@marketplace/contracts/intent";

export type GeneratedVisual = {
  artifactId: string;
  imageUrl: string;
  prompt: string;
};

export type VisualGenerator = {
  generate(input: { artifact: Artifact; record: BrandRecord; intent: Intent }): Promise<GeneratedVisual>;
};
