# Brand source pack (raw input for the Brand Agent)

What a hospitality brand realistically hands over, and what the Brand Agent extracts from each item. For the demo we author this pack for each fictional brand in `data/sources/<brand-id>/`.

## The pack

| File | Kind | Typical content | Feeds |
|---|---|---|---|
| `brand-guidelines.pdf` | Unstructured, 8–12 pages, designed | Story, logo, colours, type, photography, tone of voice | `Brand`, `BrandKit` |
| `design-tokens.json` *(optional)* | Structured | Colours and fonts as exported from Frontify/Figma | `BrandKit.colors`, `typography` (overrides the PDF) |
| `logo.svg`, `logo-mono.svg` | Asset | The logo files | `BrandKit.logos` |
| `photos/*.jpg` (6–10) | Asset | The brand's own photography: terrace, tables, people, interior | `BrandKit.photos`, tagged by the vision model |
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

## Demo brands

8 brands, all in Barcelona.
- **Only Casa Brisa gets the full source pack (PDFs)** to demonstrate extraction.
- The other 7 are hand-written `BrandRecord` JSON with 3–5 photos each, so they cost no LLM calls.
- Each one exists to make certain queries match, or visibly fail to match.

| Brand | Category | Key attributes | Offers (price) | Identity |
|---|---|---|---|---|
| **Casa Brisa** | Tapas bar | terrace, private-room, wheelchair, step-free · lively, romantic · Tue–Sun, Sun only 13–17 | Sharing menu €28 pp (min 4, V/VG/GF) · Tasting for two €46 · Vermut hour €5 pp (Tue–Thu 18–20) · Private room from €35 pp (10–20) | Terracotta and olive, Fraunces serif, warm |
| **Nami Ramen** | Ramen bar | *no terrace, not step-free* · lively | Ramen + gyoza €15 pp · Ramen night for two €30 · Vegan ramen €14 pp | Black and red, bold condensed sans, uppercase, playful |
| **Hotel Albada** | Boutique hotel + restaurant | spa, wheelchair, step-free, accessible-wc · quiet, romantic | Romantic weekend (2 nights + dinner) €340 for two · Room €150 / night · Tasting dinner €90 for two · Sunday brunch €32 pp (Sun 10–13) | Navy and gold, elegant serif, calm, framed images |
| **Verde** | Vegan restaurant | terrace, wheelchair · cosy | Group menu €22 pp (6–20, VG/GF) · Lunch menu €14 pp · Date night €40 for two | Leaf green and cream, rounded sans, airy |
| **Café Lumen** | Brunch café | wifi, power-outlets, wheelchair, step-free, accessible-wc · quiet, family | Family brunch €18 pp · Work day pass €12 pp (Mon–Fri 8–13) · Kids' menu €8 | Pastel yellow, geometric sans, friendly |
| **El Marcador** | Sports bar | tv-sports · lively | Match night (beer bucket + tapas) €15 pp · Group tapas €20 pp (min 6) | Blaugrana-adjacent navy and red, sporty italic sans, dense |
| **Terrat** | Rooftop cocktail bar | rooftop, terrace · *not step-free* · romantic, lively · 18–02 | Cocktails for two €36 · Sunset session €12 pp | Black and coral, art-deco display, duotone images |
| **Grupo Mar** | Seafood group, **2 venues** | Barceloneta: terrace, private-room · Gràcia: wheelchair, *no private room* | Celebration menu €45 pp (8–16, Barceloneta) · Paella for two €38 · Weekday lunch €20 pp | Sea blue and white, clean serif, stamp ornament |

Plus **`_house.json`**: INTENT's own brand kit, used only for the no-match fallback page and never matched.

## Coverage matrix (demo script + test fixtures)

Expected results are what the Filter/Combine steps must produce. Rank then chooses among the matches.

| # | Query | Tests | Expected matches | Expected exclusions (reason) |
|---|---|---|---|---|
| Q1 | "Friday, 8 friends, two vegans, one celiac, terrace, ~€30 each" | hard dietary + amenity + per-person budget | Casa Brisa (sharing €28), Verde (group €22) | Nami (no terrace), El Marcador, Grupo Mar (no vegan), Terrat (no food offer) |
| Q2 | "Estoy con mi pareja, tres horas libres, 50 €, esta noche" | Spanish, total budget, variety | Casa Brisa (€46), Verde (€40), Terrat (€36), Nami (€30) | Hotel Albada tasting (€90 > €50) |
| Q3 | "Romantic weekend for two, hotel and a nice dinner, €400" | **2 needs, one brand** | Hotel Albada romantic weekend (€340) → **one artifact covering both needs** | Room + Casa Brisa (€346) is valid too, but ranked lower (two brands) |
| Q4 | "Dinner and then drinks with a view, 4 of us, €60 each" | **2 needs, two brands**, overall budget | Dinner: Casa Brisa (4 × €28) → Drinks: Terrat sunset (4 × €12) = €160 ≤ €240 | Paella for two (party of 4 doesn't fit) |
| Q5 | "Sunday brunch, two adults, two kids, grandma uses a wheelchair" | accessibility (never relaxed), time | Café Lumen (family brunch), Hotel Albada (Sunday brunch) | Terrat (not step-free, closed), Casa Brisa (opens 13:00 Sunday) |
| Q6 | "Watch the Barça game tonight, 6 friends, beer and tapas" | single strong match | El Marcador (match night) | Everyone else (no tv-sports) |
| Q7 | "Quiet café with wifi and plugs, tomorrow morning, 3 hours" | amenities + weekday time | Café Lumen (work day pass) | — |
| Q8 | "Mum's 60th, 12 people, she loves seafood, private room, Saturday lunch" | venue choice, party size, soft cuisine | Grupo Mar **Barceloneta** (celebration menu), Casa Brisa (private room, ranked lower: not seafood) | Grupo Mar Gràcia (no private room) |
| Q9 | "Ramen for two tonight, on a terrace" | **relaxation** | Nami Ramen night, with `relaxed: amenities:terrace` → copy says "no terrace, but…" | — |
| Q10 | "Vegan dinner for 25 people under €10 each" | **no results** → near-miss suggestions | `NoMatch`: "Groups up to 20 at €22 pp → Verde", "Split into two tables" | Vegan is never relaxed |
| Q11 | "My car is making a weird noise" | **out of domain** | `NoMatch` out-of-domain with example queries | — |
| Q12 | "Something fun tonight" | **unclear** → defaults + variety | Nami, El Marcador, Terrat (lively) | — |

Q1, Q3, Q9 and Q10 make the strongest live demo: personalization, a combined intent, honest relaxation, and a graceful failure.
