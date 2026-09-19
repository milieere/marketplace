# System

**Status:** Draft. Types are illustrative until the stack is decided.

## Two agents

### 1. Brand Agent

- **Input:** Frontify, guidelines PDF, website, menus, free text
- **Does:** extracts and structures the data, and records a source for each field
- **Output:** `BrandKit`, `Venue`, `Offering` with status `draft`. A brand user marks them `verified`, and only verified data is used.

### 2. Intent & Creative Agent

1. **Parse** the input (voice/text/image/doc) into `UserIntent`. If a required field is missing, show one generated input control; no chat.
2. **Match** verified offerings deterministically against the hard constraints (budget, time, dietary, accessibility, location), then rank them by the soft ones (mood, cuisine).
3. **Generate** an `Artifact` per matched brand. The LLM picks a template and format, writes the copy, and chooses or generates imagery.
4. **Check:** copy prices from the data, run the brand rules, and drop anything that fails.

## Rules that make it work

- **Brand tokens are rendered, not generated.** Logo, fonts, colours and layout come from `BrandKit` through templates. Generated images never contain logos or text.
- **Prices and conditions come from `Offering`**, never from the LLM.
- **Personalization happens in what gets selected and written:** which offers, which headline, which imagery, which badges, which CTA. It never changes the brand identity.

## Data model

```ts
type BrandKit = {
  brandId: string;
  name: string;
  logos: { url: string; variant: "primary" | "mono" | "icon" }[];
  colors: { hex: string; role: "primary" | "secondary" | "accent" | "background" | "text" }[];
  fonts: { family: string; role: "heading" | "body"; url?: string }[];
  imagery: { style: string; assetUrls: string[]; generationAllowed: boolean };
  voice: { traits: string[]; dontSay: string[] };
  rules: string[];                   // checkable constraints, e.g. "logo only on light backgrounds"
  source: Source;
};

type Venue = {
  id: string;
  brandId: string;
  name: string;
  geo: { lat: number; lng: number };
  openingHours: Record<Weekday, { from: string; to: string }[]>;
  tags: string[];                    // "terrace", "wheelchair", "romantic", "private-room", "spa"
  reserveUrl: string;
  source: Source;
};

type Offering = {
  id: string;
  venueId: string;
  kind: "dish" | "menu" | "drink" | "room" | "experience";
  name: string;
  description: string;
  priceEur: number;
  priceUnit: "per-person" | "per-item" | "per-night" | "per-group";
  dietary: string[];                 // "vegan", "gluten-free"
  tags: string[];                    // "date-night", "sharing", "celebration"
  conditions?: string;               // "Tue–Thu before 21:00"
  imageUrls: string[];
  source: Source;
};

type UserIntent = {
  raw: string;                       // transcript / text / extracted doc content
  party?: { size: number; kids?: number };
  when?: { start: string; end: string };
  budget?: { eur: number; per: "total" | "person" };
  location?: { lat: number; lng: number } | string;
  hard: string[];                    // "vegan", "wheelchair", "terrace"
  soft: string[];                    // "romantic", "seafood"
  language: string;
  missing: string[];
};

type Artifact = {
  brandId: string;
  venueId: string;
  offeringIds: string[];
  format: "banner" | "card" | "landing";
  headline: string;
  body: string;
  badges: string[];
  prices: { offeringId: string; label: string; eur: number }[];   // copied from Offering
  imageUrl: string;
  cta: { label: string; url: string };
  check: { passed: boolean; issues: string[] };
};

type Source = { origin: "frontify" | "pdf" | "website" | "manual"; ref?: string; status: "draft" | "verified" };
type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
```
