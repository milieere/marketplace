import { z } from "zod";
import { Attributes } from "./vocabulary";

const party = z.object({ size: z.number().int().positive(), kids: z.number().int().nonnegative().optional() });
const budget = z.object({ amount: z.number().positive(), per: z.enum(["total", "person"]) });

export const Need = z.object({
  id: z.string(),
  label: z.string(),
  kinds: z.array(z.string()).optional(),
  when: z.object({ start: z.iso.datetime({ offset: true }), end: z.iso.datetime({ offset: true }).optional() }).optional(),
  party: party.optional(),
  budget: budget.optional(),
  required: Attributes,
  preferred: Attributes,
});
export type Need = z.infer<typeof Need>;

export const Intent = z.object({
  id: z.string(),
  raw: z.object({
    text: z.string(),
    inputs: z.array(z.object({ kind: z.enum(["voice", "text", "image", "document"]), ref: z.string().optional() })),
  }),
  scope: z.enum(["in-domain", "out-of-domain", "unclear"]),
  language: z.string(),
  party: party.extend({ relation: z.string().optional() }).optional(),
  location: z.object({ geo: z.object({ lat: z.number(), lng: z.number() }).optional(), area: z.string().optional() }).optional(),
  budget: budget.optional(),
  phrases: z.array(z.string()),
  needs: z.array(Need).max(3),
  missing: z.array(z.string()),
});
export type Intent = z.infer<typeof Intent>;
