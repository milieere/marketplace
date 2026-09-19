# INTENT — Product

> **Every brand message, personalized to what this one person just asked for, and still 100% on-brand.**

## The idea in one paragraph

Hospitality brands (hotels, restaurant groups, bars, cafés) give us their brand data: guidelines, assets, venues, menus and offers. When a person expresses an intent, for example *"Friday, 8 friends, two vegans, one celiac, terrace, ~€30 each"*, we generate **in real time** a creative unit (banner, card, mini landing) that answers *that exact query*. It uses the brand's real offers, it is rendered in the brand's own typography, colours and voice, and it links straight to a reservation.

## Where the value is

| | What it means |
|---|---|
| **1. Personalization to the query** *(core)* | The artifact is built for *this* request rather than for a segment. It changes which offers are shown, the headline, the imagery, which badges are emphasised and the pre-filled CTA. |
| **2. Brand-safe by construction** | Fonts, colours and logos are rendered from the brand kit and never generated. Every artifact comes with a compliance check. |
| **3. Grounded** | Prices, hours and conditions come from the brand's verified data and are never invented. |

**What we don't build: search.** Google, TheFork and the AI assistants already know which venues exist. We plug into places where intent already happens (the brand's own site, booking platforms, email, AI assistants) and make the result speak in the brand's voice, for this one person, right now.

## Personalization: one brand, two queries

Same brand (a tapas restaurant), two different people:

| | Query A: *"8 friends, two vegans, one celiac, terrace, €30 each"* | Query B: *"Anniversary dinner for two, something special"* |
|---|---|---|
| Offers shown | Sharing menu + vegan and GF dishes from the real menu | Tasting menu for two + wine pairing |
| Headline | "Friday on the terrace, all 8 of you covered" | "An evening just for the two of you" |
| Imagery | Full sharing table, terrace | Candle-lit table for two |
| Badges | 🌱 Vegan · Gluten-free · Terrace · €28 pp | Tasting menu · €92 for two |
| CTA | Reserve for 8, Fri 21:00 | Reserve for 2, tonight |
| Format | Card sized for sharing in a group chat | Elegant banner |

Both use the same logo, fonts, colours and tone rules.

## How it works: two agents

```
BRAND SIDE                                      USER SIDE
guidelines PDF / Frontify / website / menus     voice memo / text / image / document
            │                                                │
            ▼                                                ▼
   ┌──────────────────────┐                    ┌──────────────────────────────┐
   │ 1. Brand Agent       │  verified brand    │ 2. Intent & Creative Agent   │
   │ extract → BrandKit + │ ─────────────────▶ │ parse intent → match offers  │
   │ Locations + Offerings│      data          │ → generate personalized      │
   └──────────────────────┘                    │ on-brand artifact + check    │
                                               └──────────────────────────────┘
                                                              │
                                                              ▼
                                              Banner / card / landing + Reserve link
```

Details: [04-agents.md](04-agents.md), data: [03-data-model.md](03-data-model.md).

## Customers

- **Who pays:** hospitality brands, starting with hotel chains and multi-venue restaurant groups. They are the ones with brand guidelines, often kept in platforms such as Frontify.
- **Where artifacts appear:** the brand's website/app, reservation platforms, email/CRM, AI-assistant integrations. The consumer app in the demo is only a showcase.

## Hackathon demo

1. **Brand in:** connect Frontify or upload a guidelines PDF, and a BrandKit appears.
2. **Intent in:** a voice memo or text query.
3. **Artifacts out:** 2–3 brands, each with a personalized artifact that is clearly in its own style, with real prices and a passing compliance check.
4. **Personalization proof:** change the query and watch the same brand's artifact change.

| Invest | Keep thin | Cut |
|---|---|---|
| Artifact generation + personalization | Intent parsing | Search over many venues |
| Brand Agent (brand data → BrandKit) | Matching over ~5–10 seeded brands | Booking/payment (link out only) |
| Compliance check shown on each artifact | | Multi-brand itineraries, travel times |

## Risks

- **Imagery:** Nebius has no image generation, so artifacts use the brand's own photos, tagged by a vision model and picked per query. Generated scenes are a later option with a second provider.
- **Latency:** big models are slow (Qwen3-235B took ~14 s for one intent parse), so each step uses the smallest model that is reliable enough, and results are streamed.
- **Crowded space** (Meta/Google auto-creatives, Adobe GenStudio): differentiate on per-query personalization, checkable brand rules and grounded offers.

## Open questions

- [ ] Tech stack (proposal: TypeScript/Next.js throughout, OpenAI-compatible SDK → Nebius Token Factory)
- [ ] Which Nebius models to use per step (see the model comparison)
- [ ] Demo brands: real (via Frontify) or fictional? Which city?
- [ ] UI language: Spanish, English, or follow the user?
- [ ] Hackathon judging criteria, and team ownership
