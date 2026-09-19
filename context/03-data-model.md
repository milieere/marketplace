# Data model

**Status:** Draft, for review.

The contract between the two agents. The **Brand Agent** writes it by extracting from unstructured brand documents, and the **Creative Agent** reads it to match and generate. If a field isn't here, the Creative Agent can't use it. If it's here, the Brand Agent must be able to extract it.

## Principles

1. **Core entities are industry-agnostic.** Industry specifics live in `attributes`, whose keys and values come from a per-industry **Vocabulary** ([hospitality.json](../data/vocabularies/hospitality.json)). The extractor, the intent parser, the photo tagger and the matcher all load the same vocabulary, so a new industry means a new vocabulary file, not new code.
2. **Every extracted fact carries evidence:** document, page, quote and confidence. This powers the brand review screen and explains every artifact.
3. **Prices, hours and conditions are data.** The LLM never produces them; they are copied from `Offering`/`Venue`.
4. **Brand identity is rendered, never generated.** Colours, fonts, logos and style come from `BrandKit` and are rendered into templates. Imagery is the brand's own tagged photos, selected per intent.
5. **Artifacts carry a trace:** which intent signal and which brand fact produced each element.

## Entities

```
Vocabulary (per industry)
SourceDocument ──evidence──▶ BrandRecord = Brand + BrandKit (+ photos) + Venue[] + Offering[]
Intent ──(Creative Agent)──▶ Artifact ──▶ Brand, Venue?, Offering[], Photo?
```

| Entity | Written by | Read by |
|---|---|---|
| Vocabulary | us (hand-written) | both agents, matcher |
| SourceDocument | ingest endpoint | Brand Agent |
| BrandRecord | Brand Agent (`draft`) → brand review (`verified`) | Creative Agent (verified only) |
| Intent | Creative Agent (Understand step) | Creative Agent |
| Artifact | Creative Agent | Frontend, share link |

## Types

```ts
// ---- Vocabulary: data/vocabularies/<industry>.json
type Vocabulary = {
  industry: string;
  offeringKinds: string[];
  attributes: AttributeDef[];
};
type AttributeDef = {
  key: string;
  description: string;                            // injected into LLM prompts
  values: string[];                               // closed set
  appliesTo: ("venue" | "offering" | "photo")[];
  constraint: "hard" | "soft" | "either";         // can a user require it, or only prefer it?
  relaxable: boolean;                             // may the matcher drop it when nothing fits? false for safety needs (dietary, accessibility)
};
type Attributes = Record<string, string[]>;       // vocabulary key → values

// ---- Evidence
type SourceDocument = { id: string; kind: "pdf" | "json" | "csv" | "image" | "url" | "text"; uri: string; addedAt: string };
type Evidence = {
  field: string;                                  // path inside the BrandRecord, see "Evidence paths"
  documentId: string;
  page?: number;
  quote?: string;
  confidence: number;                             // 0..1
};

// ---- Aggregate: one per brand, the unit the Brand Agent writes and the review approves
type BrandRecord = {
  status: "draft" | "verified";
  brand: Brand;
  brandKit: BrandKit;
  venues: Venue[];
  offerings: Offering[];
  documents: SourceDocument[];
  evidence: Evidence[];
  reviewNotes: string[];                          // unresolved conflicts flagged by the Verify step
};

type Brand = {
  id: string;                                     // slug, e.g. "casa-brisa"
  name: string;
  industry: string;                               // selects the Vocabulary
  website?: string;
  summary: string;
  languages: string[];                            // languages the brand communicates in, e.g. ["es", "en", "ca"]
};

type BrandKit = {
  colors: { id: string; hex: string; role: "primary" | "secondary" | "accent" | "background" | "text"; pairsWith: string[] }[];
  typography: { role: "display" | "heading" | "body"; family: string; weights: number[]; fallback: string; fontUrl?: string }[];
  logos: { variant: "primary" | "mono" | "icon"; url: string; onBackgrounds: string[] }[];   // color ids
  style: {
    radius: number;                               // px
    density: "airy" | "balanced" | "dense";
    headlineCase: "upper" | "title" | "sentence";
    imageTreatment: "full-bleed" | "framed" | "duotone";
    composition: "image-top" | "image-side" | "text-over-image";
    ornament: "none" | "rule" | "pattern" | "stamp";
  };
  voice: {
    summary: string;
    toneRange: { formality: [number, number]; energy: [number, number] };   // 0..1
    doSay: string[];
    dontSay: string[];
    samples: string[];                            // real copy from brand docs, used as few-shot examples
  };
  imagery: { style: string; avoid: string[] };    // from the photography page; guides photo selection
  photos: Photo[];
  rules: BrandRule[];
};

type Photo = {
  id: string;
  url: string;
  description: string;                            // vision-generated, e.g. "Group of friends sharing tapas on a sunny terrace"
  people: "none" | "couple" | "group" | "family";
  orientation: "landscape" | "portrait" | "square";
  attributes: Attributes;                         // vocabulary keys that apply to photos (amenities, ambience, occasion)
};

type BrandRule = {
  id: string;
  text: string;                                   // always given to the LLM
  check?: RuleCheck;                              // present only if it can be checked in code
  severity: "block" | "warn";
};
type RuleCheck =
  | { kind: "max-length"; slot: "headline" | "subline" | "body"; max: number }
  | { kind: "forbidden-term"; terms: string[] }
  | { kind: "required-text"; text: string }
  | { kind: "min-contrast"; ratio: number };      // WCAG ratio for text over background in the rendered artifact

// ---- Catalogue
type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type TimeRange = { from: string; to: string };    // "18:00"–"01:00"; `to` < `from` means past midnight

type Venue = {
  id: string;
  name: string;
  address: string;
  timezone: string;                               // IANA, e.g. "Europe/Madrid"
  geo?: { lat: number; lng: number };
  openingHours: Partial<Record<Weekday, TimeRange[]>>;
  attributes: Attributes;
  priceLevel?: 1 | 2 | 3 | 4;
  reserveUrl?: string;
};

// A promotable offer the brand wants to push (set menu, package, promotion), not the full catalogue.
type Offering = {
  id: string;
  venueIds?: string[];                            // omitted = all venues
  kind: string;                                   // one of Vocabulary.offeringKinds
  name: string;                                   // as the brand writes it; never translated in priceLines
  description: string;
  price: { amount: number; currency: "EUR"; unit: "person" | "group" | "night"; from?: boolean };
  attributes: Attributes;
  availability?: { days?: Weekday[]; from?: string; to?: string; validUntil?: string };
  partySize?: { min?: number; max?: number };
  conditions?: string;                            // shown verbatim, never paraphrased
};

// ---- User side
// One query can hold several needs ("dinner and then drinks"). Shared context sits on Intent; each Need can override it.
type Intent = {
  id: string;
  raw: { text: string; inputs: { kind: "voice" | "text" | "image" | "document"; ref?: string }[] };
  scope: "in-domain" | "out-of-domain" | "unclear";
  language: string;                               // language of the query → language of the copy
  party?: { size: number; kids?: number; relation?: string };
  location?: { geo?: { lat: number; lng: number }; area?: string };
  budget?: { amount: number; per: "total" | "person" };   // overall, across all needs
  phrases: string[];                              // user's own words worth echoing
  needs: Need[];                                  // 1–3, in the order the user wants them
  missing: string[];
};

type Need = {
  id: string;
  label: string;                                  // "dinner", "drinks after", "hotel"
  kinds?: string[];                               // Vocabulary.offeringKinds hint, e.g. ["room", "package"]
  when?: { start: string; end?: string };         // ISO 8601 with offset, resolved from `now` + timezone
  party?: { size: number; kids?: number };        // overrides Intent.party, e.g. "brunch for 10"
  budget?: { amount: number; per: "total" | "person" };   // this need only
  required: Attributes;                           // hard
  preferred: Attributes;                          // soft (occasion, ambience, cuisine)
};

// ---- Output
type Artifact = {
  id: string;
  intentId: string;
  needIds: string[];                              // one brand can answer several needs in one artifact
  brandId: string;
  venueId?: string;
  offeringIds: string[];
  language: string;
  format: "banner" | "card";
  tone: { formality: number; energy: number };    // must lie within BrandKit.voice.toneRange
  slots: { headline: string; subline?: string; body: string; badges: string[]; cta: { label: string; url: string } };
  priceLines: { offeringId: string; label: string; amount: number; unit: string; from: boolean }[];   // copied from Offering
  photoId?: string;
  trace: { element: string; drivenBy: string[]; brandFacts: string[] }[];   // paths into Intent / BrandRecord
  check: { passed: boolean; issues: { ruleId: string; message: string; severity: "block" | "warn" }[] };
  relaxed: Relaxation[];                          // constraints that were loosened to find this match; must be stated in the copy
  htmlUrl: string;
  createdAt: string;
};

type Relaxation = { needId: string; constraint: string; from: string; to: string };   // e.g. amenities:terrace → dropped

// Returned instead of artifacts when nothing can be shown
type NoMatch = {
  reason: "out-of-domain" | "no-results";
  message: string;                                // short, in the user's language
  suggestions: { label: string; patch: { needId?: string; change: Record<string, unknown> } }[];   // tap to re-run
  html: string;                                   // fallback page rendered with the house brand kit
};
```

## Evidence paths

`Evidence.field` and `Artifact.trace` use dot paths into the record, with list items addressed by `id`:

```
brand.summary
brandKit.colors[terracotta].hex
brandKit.voice.samples
brandKit.photos[terrace-group].attributes.amenities
offerings[cb-sharing-menu].price
venues[casa-brisa-born].openingHours
```

Trace paths into the intent use the same form: `intent.needs[n1].required.dietary`, `intent.party.size`.

## Matching rules

Matching runs **per need**, then combines the results.

**1. Filter (code, all hard), per need.** The need's own `party`, `budget` and `when` override the intent's.

1. **Attributes:** every `required` value is present in the offering's or the venue's attributes. If `kinds` is set, the offering's kind is in it.
2. **Party size:** within `offering.partySize` (if set).
3. **Time:** `when.start` (and `end`) falls within the venue's `openingHours` in the venue's `timezone`, and within `offering.availability`.
4. **Budget:** first work out the cost for the party:

   | `price.unit` | Cost for the party |
   |---|---|
   | `person` | `amount × party.size` |
   | `group` | `amount` (only valid if the party fits `partySize`) |
   | `night` | `amount × nights` (1 if unknown) |

   - Then compare: `per = "total"` → cost ≤ amount. `per = "person"` → cost ÷ party.size ≤ amount.
   - `from: true` prices count at their minimum and are labelled "from".
5. **Missing values** (no budget, no time) don't filter anything.

**2. Combine (code), only when there are several needs.**
- Take the top 3 candidates per need and enumerate the combinations (at most 27).
- Keep the combinations whose total cost fits `Intent.budget`.
- A **single brand covering several needs** (hotel room + its restaurant) becomes one candidate that answers all of them.

**3. Rank (LLM).** Candidates or combinations plus `preferred` and `phrases` → top N. Each comes with the offerings to feature, the best-matching photo and a one-line rationale. The ranker prefers single-brand combinations, and the rationale goes into the trace.

**Out of scope for the demo:** distance from `location`. All brands are in one city.

## When nothing matches

| Situation | Detected by | Response |
|---|---|---|
| Off-topic ("my car makes a noise") | Understand: `scope = "out-of-domain"` | `NoMatch` with `reason: "out-of-domain"`: a friendly page with 3 example queries |
| Too vague ("something fun") | Understand: `scope = "unclear"` | Proceed with defaults (tonight, local area), rank for variety, and say so in the trace |
| Too specific (nothing survives the filter) | Filter returns zero for a need | **Relax** in this order, one step at a time, re-filtering each time: drop `preferred` → drop `relaxable` required attributes → budget +20 % → time ±60 min. `dietary`, `accessibility` and party size are **never** relaxed. Each step is recorded in `Artifact.relaxed`, and the copy states it ("No terrace tonight, but…") |
| Still nothing | Relaxation exhausted | `NoMatch` with `reason: "no-results"`. `suggestions` come from a **near-miss analysis** (code): for each blocking constraint, how many results appear without it, and at what price ("Raise budget to €22 pp → 2 options", "Smaller group (max 12) → 3 options"). Tapping a suggestion re-runs the query with that change. |

**Rules:**
- An artifact never shows a badge for a constraint it doesn't satisfy (a grounding check).
- The fallback page is rendered with the **house brand kit** (`data/brands/_house.json`, which is not used in matching), so embedding surfaces also get valid HTML.

## What drives generation

| Field | Drives |
|---|---|
| `colors`, `typography`, `logos`, `style` | Template rendering (code). `style` is what makes brands look different, not just recoloured. |
| `voice.samples`, `doSay`, `dontSay` | Copy style (few-shot) |
| `voice.toneRange` + `need.preferred.occasion` | `Artifact.tone`, i.e. how formal or energetic the copy is |
| `photos[].attributes`, `people` + `intent.party`, `need.required`, `need.preferred` | Photo selection |
| `rules` | Checks after generation; `block` failures trigger a rewrite |
| `need.required` ∩ offering/venue `attributes` | Badges ("🌱 vegan", "terrace"), only for satisfied constraints |
| `artifact.relaxed` | An honest line in the copy about what couldn't be met |
| `intent.phrases` | Headline wording |
| `intent.language` | Copy language. Offering names stay as the brand wrote them. |
| `offering.price`, `conditions` | `priceLines` and small print (copied as-is) |
| `venue.reserveUrl` + `intent.party`, `need.when` | CTA ("Reserve for 8, Fri 21:00") |

## Storage (demo)

- One JSON file per brand: `data/brands/<brand-id>.json` (a `BrandRecord`). See [example-brand.json](../data/brands/example-brand.json).
- Source packs, including photos and logos: `data/sources/<brand-id>/`, served as static assets.
- Artifacts: the blob store.
