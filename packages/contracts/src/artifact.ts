import { z } from "zod";
import { BrandKit, PriceUnit } from "./brand-record";

const unit = z.number().min(0).max(1);

export const Relaxation = z.object({
  needId: z.string(),
  constraint: z.string(),
  from: z.string(),
  to: z.string(),
});
export type Relaxation = z.infer<typeof Relaxation>;

export const ArtifactPresentation = z.object({
  brand: z.object({
    id: z.string(),
    name: z.string(),
    summary: z.string(),
  }),
  kit: BrandKit.pick({
    colors: true,
    typography: true,
    logos: true,
    style: true,
    voice: true,
    imagery: true,
  }),
  photo: z
    .object({
      id: z.string(),
      src: z.string(),
      alt: z.string(),
      orientation: z.enum(["landscape", "portrait", "square"]),
    })
    .optional(),
  logo: z.object({ src: z.string() }).optional(),
  layout: z
    .object({
      frame: z.enum(["poster", "editorial", "split"]),
      logoCorner: z.enum(["top-left", "top-right", "bottom-left", "top-center"]),
      copyAnchor: z.enum(["bottom-left", "bottom-right", "below-media", "side-right", "top-left", "centre"]),
      align: z.enum(["left", "centre"]),
      showSubline: z.boolean(),
      showBody: z.boolean(),
      showBadges: z.boolean(),
      priceStyle: z.enum(["hero", "editorial", "inline"]),
      headlineScale: z.number(),
      scrim: z.enum(["bottom", "top", "left", "right", "none"]),
      rule: z.boolean(),
      stamp: z.boolean(),
    })
    .optional(),
});
export type ArtifactPresentation = z.infer<typeof ArtifactPresentation>;

export const Artifact = z.object({
  id: z.string(),
  intentId: z.string(),
  needIds: z.array(z.string()).min(1),
  brandId: z.string(),
  locationId: z.string().optional(),
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
    z.object({ offeringId: z.string(), label: z.string(), amount: z.number().nonnegative(), unit: PriceUnit, from: z.boolean() }),
  ),
  photoId: z.string().optional(),
  trace: z.array(z.object({ element: z.string(), drivenBy: z.array(z.string()), brandFacts: z.array(z.string()) })),
  check: z.object({
    passed: z.boolean(),
    issues: z.array(z.object({ ruleId: z.string(), message: z.string(), severity: z.enum(["block", "warn"]) })),
  }),
  relaxed: z.array(Relaxation),
  presentation: ArtifactPresentation.optional(),
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
