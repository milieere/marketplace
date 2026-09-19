import { z } from "zod";

export const Attributes = z.record(z.string(), z.array(z.string()));
export type Attributes = z.infer<typeof Attributes>;

export const AttributeDef = z.object({
  key: z.string(),
  description: z.string(),
  values: z.array(z.string()).min(1),
  appliesTo: z.array(z.enum(["location", "offering", "photo"])).min(1),
  constraint: z.enum(["hard", "soft", "either"]),
  relaxable: z.boolean(),
});
export type AttributeDef = z.infer<typeof AttributeDef>;

export const Vocabulary = z.object({
  industry: z.string(),
  offeringKinds: z.array(z.string()).min(1),
  attributes: z.array(AttributeDef),
});
export type Vocabulary = z.infer<typeof Vocabulary>;
