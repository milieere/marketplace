import { z } from "zod";
import { Attributes } from "./vocabulary";

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const unit = z.number().min(0).max(1);

export const Weekday = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
export type Weekday = z.infer<typeof Weekday>;

export const TimeRange = z.object({ from: time, to: time });

export const SourceDocument = z.object({
  id: z.string(),
  kind: z.enum(["pdf", "json", "csv", "image", "url", "text"]),
  uri: z.string(),
  addedAt: z.iso.datetime({ offset: true }),
});
export type SourceDocument = z.infer<typeof SourceDocument>;

export const Evidence = z.object({
  field: z.string(),
  documentId: z.string(),
  page: z.number().int().positive().optional(),
  quote: z.string().optional(),
  confidence: unit,
});
export type Evidence = z.infer<typeof Evidence>;

export const Brand = z.object({
  id: z.string(),
  name: z.string(),
  industry: z.string(),
  website: z.string().optional(),
  summary: z.string(),
  languages: z.array(z.string()).min(1),
});
export type Brand = z.infer<typeof Brand>;

export const RuleCheck = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("max-length"), slot: z.enum(["headline", "subline", "body"]), max: z.number().int().positive() }),
  z.object({ kind: z.literal("forbidden-term"), terms: z.array(z.string()).min(1) }),
  z.object({ kind: z.literal("required-text"), text: z.string() }),
  z.object({ kind: z.literal("min-contrast"), ratio: z.number().positive() }),
]);
export type RuleCheck = z.infer<typeof RuleCheck>;

export const BrandRule = z.object({
  id: z.string(),
  text: z.string(),
  check: RuleCheck.optional(),
  severity: z.enum(["block", "warn"]),
});
export type BrandRule = z.infer<typeof BrandRule>;

export const Photo = z.object({
  id: z.string(),
  url: z.string(),
  description: z.string(),
  people: z.enum(["none", "couple", "group", "family"]),
  orientation: z.enum(["landscape", "portrait", "square"]),
  attributes: Attributes,
});
export type Photo = z.infer<typeof Photo>;

export const BrandKit = z.object({
  colors: z.array(
    z.object({
      id: z.string(),
      hex,
      role: z.enum(["primary", "secondary", "accent", "background", "text"]),
      pairsWith: z.array(z.string()),
    }),
  ).min(1),
  typography: z.array(
    z.object({
      role: z.enum(["display", "heading", "body"]),
      family: z.string(),
      weights: z.array(z.number().int()),
      fallback: z.string(),
      fontUrl: z.string().optional(),
    }),
  ).min(1),
  logos: z.array(
    z.object({
      variant: z.enum(["primary", "mono", "icon"]),
      url: z.string(),
      onBackgrounds: z.array(z.string()),
    }),
  ),
  style: z.object({
    radius: z.number().min(0),
    density: z.enum(["airy", "balanced", "dense"]),
    headlineCase: z.enum(["upper", "title", "sentence"]),
    imageTreatment: z.enum(["full-bleed", "framed", "duotone"]),
    composition: z.enum(["image-top", "image-side", "text-over-image"]),
    ornament: z.enum(["none", "rule", "pattern", "stamp"]),
  }),
  voice: z.object({
    summary: z.string(),
    toneRange: z.object({ formality: z.tuple([unit, unit]), energy: z.tuple([unit, unit]) }),
    doSay: z.array(z.string()),
    dontSay: z.array(z.string()),
    samples: z.array(z.string()),
  }),
  imagery: z.object({ style: z.string(), avoid: z.array(z.string()) }),
  photos: z.array(Photo),
  rules: z.array(BrandRule),
});
export type BrandKit = z.infer<typeof BrandKit>;

export const Venue = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  timezone: z.string(),
  geo: z.object({ lat: z.number(), lng: z.number() }).optional(),
  openingHours: z.partialRecord(Weekday, z.array(TimeRange)),
  attributes: Attributes,
  priceLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  reserveUrl: z.string().optional(),
});
export type Venue = z.infer<typeof Venue>;

export const Offering = z.object({
  id: z.string(),
  venueIds: z.array(z.string()).optional(),
  kind: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.object({
    amount: z.number().nonnegative(),
    currency: z.literal("EUR"),
    unit: z.enum(["person", "group", "night"]),
    from: z.boolean().optional(),
  }),
  attributes: Attributes,
  availability: z
    .object({ days: z.array(Weekday).optional(), from: time.optional(), to: time.optional(), validUntil: z.string().optional() })
    .optional(),
  partySize: z.object({ min: z.number().int().positive().optional(), max: z.number().int().positive().optional() }).optional(),
  conditions: z.string().optional(),
});
export type Offering = z.infer<typeof Offering>;

export const BrandRecord = z.object({
  status: z.enum(["draft", "verified"]),
  brand: Brand,
  brandKit: BrandKit,
  venues: z.array(Venue).min(1),
  offerings: z.array(Offering),
  documents: z.array(SourceDocument),
  evidence: z.array(Evidence),
  reviewNotes: z.array(z.string()),
});
export type BrandRecord = z.infer<typeof BrandRecord>;

export const BrandSummary = z.object({
  id: z.string(),
  name: z.string(),
  logoUrl: z.string().optional(),
  status: z.enum(["draft", "verified"]),
});
export type BrandSummary = z.infer<typeof BrandSummary>;
