import { z } from "zod";

const unit = z.number().min(0).max(1);

export const Relaxation = z.object({
  needId: z.string(),
  constraint: z.string(),
  from: z.string(),
  to: z.string(),
});
export type Relaxation = z.infer<typeof Relaxation>;

export const Artifact = z.object({
  id: z.string(),
  intentId: z.string(),
  needIds: z.array(z.string()).min(1),
  brandId: z.string(),
  venueId: z.string().optional(),
  offeringIds: z.array(z.string()).min(1),
  language: z.string(),
  format: z.enum(["banner", "card"]),
  tone: z.object({ formality: unit, energy: unit }),
  slots: z.object({
    headline: z.string(),
    subline: z.string().optional(),
    body: z.string(),
    badges: z.array(z.string()),
    cta: z.object({ label: z.string(), url: z.string() }),
  }),
  priceLines: z.array(
    z.object({ offeringId: z.string(), label: z.string(), amount: z.number().nonnegative(), unit: z.string(), from: z.boolean() }),
  ),
  photoId: z.string().optional(),
  trace: z.array(z.object({ element: z.string(), drivenBy: z.array(z.string()), brandFacts: z.array(z.string()) })),
  check: z.object({
    passed: z.boolean(),
    issues: z.array(z.object({ ruleId: z.string(), message: z.string(), severity: z.enum(["block", "warn"]) })),
  }),
  relaxed: z.array(Relaxation),
  htmlUrl: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type Artifact = z.infer<typeof Artifact>;

export const NoMatch = z.object({
  reason: z.enum(["out-of-domain", "no-results"]),
  message: z.string(),
  suggestions: z.array(
    z.object({
      label: z.string(),
      patch: z.object({ needId: z.string().optional(), change: z.record(z.string(), z.unknown()) }),
    }),
  ),
  html: z.string(),
});
export type NoMatch = z.infer<typeof NoMatch>;
