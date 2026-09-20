# Build plan: where we are, what's next

**This is the entry point for building.** Start here in a new session, then read only the docs linked for the piece you're working on. Update the Status section and tick the table after every PR.

## Status (2026-09-19, ~5 h to demo)

| | |
|---|---|
| Merged | #2 monorepo scaffold (npm workspaces, `apps/web` JS, `apps/api` TS, `packages/contracts`); #3 API contract + mock mode (`MOCK=1` replays recorded event streams; the frontend builds against it) |
| Merged | #4 Match (`domain/time.ts`, `cost.ts`, `match.ts`); #5 Creative Agent pipeline + card render + `GET /v1/artifacts/:id` + stand-in photos; #6 Nebius adapter (`MODEL_TEXT=deepseek-ai/DeepSeek-V4-Pro-0813`, global endpoint `https://api.tokenfactory.nebius.com/v1`; us-north1 serves only 4 models) and `npm run e2e:live`: **12/12 coverage queries pass live** |
| Merged | **Full-card visuals** `feat/fal-full-card-visual`: the whole card is one generated image from fal Nano Banana Pro (`VISUAL_MODE=full-card`), built on the `VisualGenerator` port from `feat/ui-design`. Nine SVG brand marks + `npm run build:logos`; brand fixtures levelled up for distinctiveness; `cardDesign()` shared by the HTML and image renderers; `npm run visual:samples` for a per-brand contact sheet |
| In flight | **Brand Agent** #7 `feat/06-brand-agent`: Casa Brisa source pack (`npm run build:sources`), `agents/brand/*`, live `POST /v1/brands/ingest`, `npm run eval:extraction` |
| Next | Frontend on top of the live API (handoff message sent), `eval:intents` (optional; `e2e:live` already covers Q1–Q12 end to end) |
| Frontend | the colleague owns `apps/web` and builds against `MOCK=1`. Don't edit `apps/web` beyond wiring. |

## Decisions (don't reopen)

- **Creative Agent is the simple 4-step design below.** The full 6-step design in [04-agents.md](04-agents.md) (4-step relaxation ladder, near-miss suggestions, Combine, separate Rank, 3 rewrites) is **later**.
- **Vercel AI SDK** (`ai` + `@ai-sdk/openai-compatible` → Nebius Token Factory) for LLM calls, wrapped behind an `Llm` port. Models: `MODEL_TEXT` (DeepSeek-V4-Pro), fallback `MODEL_TEXT_FALLBACK` (Nemotron-super). See the model comparison in [04-agents.md](04-agents.md).
- **Evals are deterministic only:** ~12 intent cases scored correct / missed / **invented**, plus automatic checks on generated ads. No LLM judge, no Langfuse.
- **Brand Agent stays mocked** (a recorded stream); a real one only if time is left.
- **The contract stays stable.** New fields are optional with defaults; the agent emits the same `AgentEvent`s as the recordings, so the frontend only flips `MOCK=0`.

## The Creative Agent (simple design)

```
"Friday, 8 friends, two vegans, terrace, €30 each"
1 UNDERSTAND (AI)    sentence → Intent (party, when, budget, required/preferred/avoid per need, phrases);
                     vocabulary injected; invalid values dropped; defaults applied in code → `assumed`
2 MATCH      (code)  every offer × location: brandIds, kinds, required (offer ∪ location attrs), avoid,
                     party size, budget (cost per PriceUnit), opening hours + availability in the location's
                     timezone (incl. past midnight) → matches + one reason per excluded brand.
                     None? One "closest match" pass: drop location-only attributes (terrace, ambience;
                     "where" before "what") + budget +20 %; never dietary, accessibility or party size.
                     Top 3 brands by a simple score (preferred attributes hit, price fit).
3 CREATE     (AI)    per brand in parallel: pick which of ITS offers + photo (ids as enums) and write
                     headline/body/badges/CTA in the brand voice → CHECK (code): rule checks, no € amounts
                     in the copy → one rewrite if a block rule fails (`revision` event)
4 RENDER     (code)  card template from colours/fonts/style/photo; prices copied from data → `artifact`.
                     Off-topic or nothing matches → house-brand fallback page (`no-match`) with example queries.
```

Multi-part queries ("dinner then drinks") are matched per need, with no cross-need budget maths.

## Build table

| # | PR | Files (apps/api/src) | Test / review | Est. | Done |
|---|---|---|---|---|---|
| 1 | **Match** (#4) | `domain/time.ts`, `cost.ts`, `match.ts` | unit tests from the coverage matrix (Q1, Q2, Q5–Q10) with hand-written intents | 45 m | ☑ |
| 2 | **Agent pipeline + render + live route** (offline) | `domain/color.ts`, `domain/check.ts`, `templates/card.ts`, `templates/fallback.ts`, `ports/llm.ts`, `ports/artifact-store.ts`, `adapters/memory/artifact-store.ts`, `agents/creative/{understand,create,creative-agent}.ts`, `prompts/{understand,create}.md`, `container.ts`, routes `generate` (MOCK=0) + `GET /v1/artifacts/:id`, `npm run render:samples` | agent tests with a scripted `FakeLlm` through the HTTP app: event order as in the recordings; Q1 2 artifacts, Q9 relaxed, Q10/Q11 no-match; prices equal data; a "€" in copy → `revision`. **Visual review** of `out/samples/*.html` | 2 h | ☐ |
| 3 | **Live LLM + eval** | `adapters/nebius/ai-sdk-llm.ts`, `data/evals/intents.json`, `scripts/eval-intents.ts`, `scripts/e2e-generate.ts` | `npm run eval:intents`: 0 invented, ≥ 10/12 correct. `npm run e2e:live` (Q1, Q2, Q5–Q12 against `MOCK=0`: done, no error, expected brands, prices equal data, < 30 s); frontend works unchanged | 1 h 15 m | ☐ |
| 5 | **Buffer** | demo run-through, fixes; real Brand Agent only if time | 3 clean demo runs | 45 m | ☐ |

## Read before working on…

| Piece | Read |
|---|---|
| Any data or contract change | [03-data-model.md](03-data-model.md), [`packages/contracts/README.md`](../packages/contracts/README.md) |
| Match (PR 1) | [05-brand-sources.md](05-brand-sources.md): the brand roster + **coverage matrix Q1–Q12** (expected matches and exclusions) |
| Render (PR 2) | `BrandKit` in [03-data-model.md](03-data-model.md) (`style`, `colors.pairsWith`, `rules`) |
| LLM steps (PR 3–4) | [04-agents.md](04-agents.md) (model comparison + "lessons for `Llm.structured`"), the recordings in `packages/contracts/fixtures/` (the event shapes to reproduce) |
| Code layout | [06-architecture.md](06-architecture.md) (ports and adapters, composition root, API table) |
| Why the product works this way | [01-product.md](01-product.md) |

## Conventions

- **One branch and one PR per row** (`feat/<nn>-<name>`), concise PR body. Tick the row and update Status when merged.
- **Tests** go in `apps/api/test/`, mirroring `src/`. `npm run typecheck` and `npm test` must be green.
- **Norma `live_check`** on every changed source file; fix HIGH/CRITICAL findings. `register_applied_actions` fails until the repo is imported in the Quality Clouds portal (known).
- **Code rules:** agents depend on ports, not adapters; only `container.ts` wires adapters. No barrel files. Types come from `@marketplace/contracts`. The LLM never supplies prices, hours or conditions.
- **Data notes:** `cuisine` is `either` (a user can require "ramen"). Terrat has a late "Rooftop round" offer for Q4. Photo files don't exist yet; templates fall back to a gradient in brand colours.
