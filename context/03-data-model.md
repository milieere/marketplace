# Data model

**Status:** Draft, for review.

The contract between the two agents. The **Brand Agent** writes it by extracting from unstructured brand documents, and the **Creative Agent** reads it to match and generate. If a field isn't here, the Creative Agent can't use it. If it's here, the Brand Agent must be able to extract it.

## Principles

1. **Core entities are industry-agnostic.** Industry specifics live in `attributes`, whose keys and values come from a per-industry **Vocabulary** ([hospitality.json](../data/vocabularies/hospitality.json)). The extractor, the intent parser and the matcher all load the same vocabulary, so a new industry means a new vocabulary file, not new code.
2. **Every extracted fact carries evidence:** document, page, quote and confidence. This powers the brand review screen and explains every artifact.
3. **Prices, hours and conditions are data.** The LLM never produces them; they are copied from `Offering`/`Venue`.
4. **Brand identity is rendered, never generated.** Colours, fonts and logos come from `BrandKit` and are rendered into templates.
5. **Artifacts carry a trace:** which intent signal and which brand fact produced each element.

## Entities

```
Vocabulary (per industry)
SourceDocument ──evidence──▶ Brand ─1─ BrandKit
                               └─*─ Venue ─*─ Offering
Intent ──(Creative Agent)──▶ Artifact ──▶ Brand, Venue?, Offering[]
```

| Entity | Written by | Read by |
|---|---|---|
| Vocabulary | us (hand-written) | both agents, matcher |
| SourceDocument | ingest endpoint | Brand Agent |
| Brand, BrandKit, Venue, Offering | Brand Agent (`draft`) → brand review (`verified`) | Creative Agent |
| Intent | Creative Agent (parse step) | Creative Agent |
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
  appliesTo: ("venue" | "offering")[];
  constraint: "hard" | "soft" | "either";         // can a user require it, or only prefer it?
};

// ---- Evidence
type SourceDocument = { id: string; brandId: string; kind: "pdf" | "url" | "image" | "text"; uri: string; addedAt: string };
type Evidence = { field: string; documentId: string; page?: number; quote?: string; confidence: number };
type Extracted = { status: "draft" | "verified"; evidence: Evidence[] };

// ---- Brand
type Brand = Extracted & { id: string; name: string; industry: string; website?: string; summary: string };

type BrandKit = Extracted & {
  brandId: string;
  colors: { id: string; hex: string; role: "primary" | "secondary" | "accent" | "background" | "text"; pairsWith: string[] }[];
  typography: { role: "display" | "heading" | "body"; family: string; weights: number[]; fallback: string; fontUrl?: string }[];
  logos: { variant: "primary" | "mono" | "icon"; url: string; onBackgrounds: string[] }[];   // color ids
  shape: { radius: number; spacing: "airy" | "balanced" | "dense" };
  voice: {
    summary: string;
    toneRange: { formality: [number, number]; energy: [number, number] };   // 0..1
    doSay: string[];
    dontSay: string[];
    samples: string[];                            // real copy from brand docs, used as few-shot examples
  };
  imagery: { style: string; avoid: string[]; generation: "allowed" | "scene-only" | "forbidden" };
  rules: {
    id: string;
    text: string;                                 // always given to the LLM
    check?: { kind: "max-length" | "forbidden-term" | "required-text" | "contrast"; params: Record<string, unknown> };
    severity: "block" | "warn";
  }[];
};

// ---- Catalogue
type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

type Venue = Extracted & {
  id: string; brandId: string; name: string; address: string;
  geo?: { lat: number; lng: number };
  openingHours: Partial<Record<Weekday, { from: string; to: string }[]>>;
  attributes: Record<string, string[]>;           // vocabulary keys → values
  priceLevel?: 1 | 2 | 3 | 4;
  reserveUrl?: string;
};

// A promotable offer the brand wants to push (set menu, package, promotion), not the full catalogue.
type Offering = Extracted & {
  id: string; brandId: string;
  venueId?: string;                               // omitted = available at all venues
  kind: string;                                   // one of Vocabulary.offeringKinds
  name: string; description: string;
  price: { amount: number; currency: "EUR"; unit: "person" | "item" | "night" | "group"; from?: boolean };
  attributes: Record<string, string[]>;
  availability?: { days?: Weekday[]; from?: string; to?: string; validUntil?: string };
  conditions?: string;                            // shown verbatim, never paraphrased
  partySize?: { min?: number; max?: number };
};

// ---- User side
type Intent = {
  id: string;
  raw: { text: string; inputs: { kind: "voice" | "text" | "image" | "document"; ref?: string }[] };
  language: string;
  party?: { size: number; kids?: number; relation?: string };
  when?: { start: string; end?: string };
  budget?: { amount: number; per: "total" | "person" };
  location?: { geo?: { lat: number; lng: number }; area?: string };
  required: Record<string, string[]>;             // hard, vocabulary keys → values
  preferred: Record<string, string[]>;            // soft
  occasion?: string;
  phrases: string[];                              // user's own words worth echoing
  missing: string[];
};

// ---- Output
type Artifact = {
  id: string; intentId: string; brandId: string; venueId?: string;
  offeringIds: string[];
  format: "banner" | "card";
  tone: { formality: number; energy: number };    // must lie within BrandKit.voice.toneRange
  slots: { headline: string; subline?: string; body: string; badges: string[]; cta: { label: string; url: string } };
  priceLines: { offeringId: string; label: string; amount: number; unit: string }[];   // copied from Offering
  image?: { url: string; prompt: string; generated: boolean };
  trace: { element: string; drivenBy: string[]; brandFacts: string[] }[];
  check: { passed: boolean; issues: { ruleId: string; message: string }[] };
  htmlUrl: string;
  createdAt: string;
};
```

## What drives generation

| Field | Drives |
|---|---|
| `BrandKit.colors`, `typography`, `logos`, `shape` | Template rendering (deterministic) |
| `BrandKit.voice.samples`, `doSay`, `dontSay` | Copy style (few-shot) |
| `BrandKit.voice.toneRange` + `Intent.occasion` | `Artifact.tone`, i.e. how formal or energetic the copy is |
| `BrandKit.imagery` + `Intent.party`, `occasion`, `required` | Image prompt (scene only, no logos or text) |
| `BrandKit.rules` | Checks after generation; `block` failures trigger a rewrite |
| `Intent.required` ∩ `Offering/Venue.attributes` | Badges ("🌱 vegan", "terrace") |
| `Intent.phrases` | Headline wording |
| `Offering.price`, `conditions` | `priceLines` and small print (copied as-is) |
| `Venue.reserveUrl` + `Intent.party`, `when` | CTA ("Reserve for 8, Fri 21:00") |

## Matching

1. **Deterministic filter:**
   - `Intent.required` ⊆ the union of venue and offering `attributes`
   - price fits the budget
   - venue is open during `when`
   - party size fits
2. **LLM ranking:** the survivors plus `preferred`, `occasion` and `phrases` → top N brands, each with the offerings to feature and a one-line rationale. The rationale goes into `Artifact.trace`.

## Storage (demo)

One JSON file per brand in `data/brands/<brand-id>.json`:

```json
{ "brand": {}, "brandKit": {}, "venues": [], "offerings": [], "documents": [] }
```

See [example-brand.json](../data/brands/example-brand.json). Artifacts and generated images go to the blob store, not to these files.
