# Brand source pack (raw input for the Brand Agent)

What a hospitality brand realistically hands over, and what the Brand Agent extracts from each item. For the demo we author this pack for each fictional brand in `data/sources/<brand-id>/`.

## The pack

| File | Kind | Typical content | Feeds |
|---|---|---|---|
| `brand-guidelines.pdf` | Unstructured, 8–12 pages, designed | Story, logo, colours, type, photography, tone of voice | `Brand`, `BrandKit` |
| `design-tokens.json` *(optional)* | Structured | Colours and fonts as exported from Frontify/Figma | `BrandKit.colors`, `typography` (overrides the PDF) |
| `logo.svg`, `logo-mono.svg` | Asset | The logo files | `BrandKit.logos` |
| `offers.pdf` or `offers.csv` | Semi-structured, 1–2 pages | Current promotable offers: name, price, conditions, occasion | `Offering[]` |
| `venue-factsheet.pdf` or website URL | Semi-structured | Address, hours, amenities, accessibility | `Venue[]` |

The pack deliberately mixes **designed PDF**, **structured JSON/CSV** and **plain facts**, so the demo shows the agent handling all three.

## Brand guidelines PDF: page by page

| Page | Section | Typical content | Extraction challenge |
|---|---|---|---|
| 1 | Cover | Logo, brand name, tagline | Tagline → `voice.samples` |
| 2 | Our story | Mission, values, "we are / we are not" | → `Brand.summary`, `voice.summary` |
| 3 | Logo | Primary, mono and icon versions | Vision: identify the variants |
| 4 | Logo usage | Clear space, minimum size, allowed backgrounds, misuse examples ("don't stretch", "don't place on photos") | Mix of rules and images → `logos.onBackgrounds`, `rules` |
| 5 | Colour palette | Swatches with names, HEX / RGB / CMYK / Pantone, primary vs. secondary | Vision + text; CMYK or Pantone only → normalize |
| 6 | Colour usage | Ratios ("60/30/10"), allowed combinations | → `pairsWith`, `rules` |
| 7 | Typography | Families, weights, hierarchy (H1/H2/body), sizes | → `typography`; licensed font → web fallback |
| 8 | Tone of voice | Personality traits, "we say / we don't say", example headlines | → `voice.doSay`, `dontSay`, `samples`, `toneRange` (inferred) |
| 9 | Photography | Mood, lighting, composition, do/don't grid of images | Vision → `imagery.style`, `avoid` |
| 10 | Applications | Example social post, menu cover, ad banner | Real copy → `voice.samples`; layout hints → `shape` |

Real guidelines are inconsistent in helpful ways that we should reproduce: the colour name differs between pages, one colour has only CMYK values, "never" rules are hidden in captions. These exercise the Normalize and Verify steps.

## Offers sheet: what's in it (and what's not)

Only the **promotable offers** the brand wants to push, typically 3–8, not the full menu:

| Offer | Price | Conditions | Good for |
|---|---|---|---|
| Sharing menu (vegan and gluten-free options) | €28 pp | min. 4 people | groups, celebrations |
| Tasting for two with cava | €46 for two | Tue–Sat from 19:30 | date night |
| Vermut hour on the terrace | €5 pp | Tue–Thu 18:00–20:00 | after-work groups |
| Private room celebration | from €35 pp | 10–20 people, 48 h notice | birthdays, business |

For a hotel, the same sheet holds packages (romantic weekend, spa day). The shape is the same across industries: **name, price, unit, conditions, who it's for**.

## Demo brands (proposal)

Three brands that are deliberately different, so each artifact shows off its own identity:

| Brand | Type | Identity | Tone range |
|---|---|---|---|
| **Casa Brisa** | Tapas bar, Barcelona | Terracotta and olive, serif display, warm | casual, medium energy |
| **Nami Ramen** | Ramen bar | Black, red, bold sans, playful | casual, high energy |
| **Hotel Albada** | Boutique hotel + restaurant | Navy, gold, elegant serif, calm | formal, low energy |
