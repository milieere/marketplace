# Build plan

**Status:** Draft. Components are built one at a time, each tested and reviewed on its own before the next one starts.

## How each component is delivered

1. **Branch:** `feat/<nn>-<component>`, one component per branch.
2. **Build** the component and its tests. No code for later components.
3. **Test:** the component's own check (table below) passes, and so do `npm run typecheck` and `npm test`.
4. **Norma:** `live_check` on every changed source file; fix HIGH/CRITICAL findings.
5. **Review:** a short PR description saying what to look at, plus the test output or a screenshot. You review, then merge.

Estimates are for the backend owner, with the AI pair doing the typing.

## Phase A — Foundation (unblocks the frontend)

| # | Component | Delivers | Test | Review focus | Est. |
|---|---|---|---|---|---|
| 01 | **Workspace scaffold** | On top of the FE branch's npm workspace: `apps/api` (Hono, TS) with `/health` and `config.ts` (Zod env), `packages/contracts` skeleton, root scripts for both apps; remove `packages/ai`, `core`, `shared` and the empty Next API routes | `npm run typecheck`; `curl /health` → ok; a missing env var fails at startup | Folder structure matches [06-architecture.md](06-architecture.md) | 30 m |
| 02 | **Contracts + mock mode** | `packages/contracts` (requests, `AgentEvent`, artifact summary); recorded event fixtures; `MOCK=1` streams for `/v1/generate` and `/v1/brands/ingest` | Fixtures validate against the schemas; `curl -N` streams events | **Review together with the frontend dev**: event shapes and names | 45 m |
| 03 | **Domain schemas** | Zod for `BrandRecord`, `Intent`, `Artifact`, `Vocabulary`; vocabulary validation | All files in `data/brands/` validate; unknown attribute values are rejected | Code matches [03-data-model.md](03-data-model.md) | 30 m |

**Checkpoint A:** the frontend dev builds the UI against the mock stream from here on.

## Phase B — Demo data and pure logic (no LLM)

| # | Component | Delivers | Test | Review focus | Est. |
|---|---|---|---|---|---|
| 04 | **Seed brands** | The 7 JSON brands + `_house.json` from [05-brand-sources.md](05-brand-sources.md), logos, 3–5 photos each | Test 03 validates all of them; each brand's facts match the coverage matrix | Brands are visibly different in colour, type, `style` and tone | 1.5 h |
| 05 | **Filter, relax, combine** (`domain/filter.ts`, `relax.ts`, `combine.ts`) | Per-need filter (budget arithmetic, hours past midnight in the venue's timezone, party size, attributes); relaxation ladder; near-miss suggestions; multi-need combinations | **Coverage matrix Q1–Q10 as fixtures** (hand-written intents → expected matches, exclusions, relaxations, NoMatch) | The fixtures: do they match how we think matching should behave? | 1.5 h |
| 06 | **Colour + checks** (`domain/color.ts`, `domain/check.ts`) | CMYK/RGB → hex, WCAG contrast, the 4 rule-check kinds, grounding checks | Unit tests (CMYK `15 0 46 58` → `#5B6B3A`) | Rule semantics | 30 m |
| 07 | **Templates** (`banner`, `card`) | `(spec, brandKit) → HTML`, driven by `style` (composition, case, treatment, ornament) | Render 3 brands × 2 formats with fixed slots into `out/*.html`, then open and screenshot | **Visual review**: does each brand look like itself? | 1.5 h |

**Checkpoint B:** hand-written slots render as convincing branded artifacts. This is the visual core of the demo, proven before any LLM is involved.

## Phase C — Creative Agent (LLM steps, one at a time)

| # | Component | Delivers | Test | Review focus | Est. |
|---|---|---|---|---|---|
| 08 | **LLM port + Nebius adapter** | `Llm.structured`: JSON schema → Zod validation → one retry with the error → fallback model; latency logging | Unit test with a fake client (retry and fallback); one live smoke test (skipped without a key) | Error handling, logs | 45 m |
| 09 | **Understand** | Prompt + schema → `Intent` with `scope` and `needs`; `now` and `timezone` handling | `npm run eval:intents`: coverage matrix Q1–Q12 → expected scope, needs and key fields, target ≥ 11/12 | The failed queries and the prompt | 1 h |
| 10 | **Rank** | Survivors → top N brands with offers, photo and rationale | Fixture intents → expected brands (loose assertions) | The rationales make sense | 45 m |
| 11 | **Create + revise** | Draft slots, tone, trace; the check → revise loop (max 3 rounds) | 3 demo queries: checks pass, prices copied exactly, tone in range; a fake failing draft triggers a revision | Copy quality per brand | 1.5 h |
| 12 | **Creative Agent + `/v1/generate`** | Orchestration, parallel per brand, SSE events, artifacts in the blob store, NoMatch page with the house brand kit | `curl -N` with Q1–Q12: first artifact in under 20 s; Q10 and Q11 return a NoMatch page; one brand failing doesn't stop the others | **Live review with the frontend dev**, mock mode switched off | 1 h |

**Checkpoint C:** the full user flow works end to end with seeded brands.

## Phase D — Brand Agent

| # | Component | Delivers | Test | Review focus | Est. |
|---|---|---|---|---|---|
| 13 | **Casa Brisa source pack** | HTML → PDF build script; 7-page guidelines, offers, venue fact sheet; `expected.json` = the current example brand | Every value in `expected.json` appears in the PDF text layer | Does the PDF look like a real brand book? | 1 h |
| 14 | **PDF reader** | Text per page + page PNGs | Hex codes found on the right pages | — | 30 m |
| 15 | **Route + extractors** | One extractor per topic, **added one at a time**: colours → typography → voice → style/logos → offers → venue → photo tags | `npm run eval:extraction` shows the score per topic against `expected.json` | Score and misses per topic | 2 h |
| 16 | **Normalize + Verify** | Colour maths, vocabulary mapping, conflict re-check loop | The CMYK-only colour comes out correct; the eval score doesn't drop | What gets flagged in `reviewNotes` | 45 m |
| 17 | **Brand Agent + ingest/verify endpoints** | Orchestration, `finding` events, save draft, verify | Ingest → draft saved → verify → the brand appears in `/v1/generate` results | Live review of the event stream | 45 m |

**Checkpoint D:** a PDF goes in, a brand is extracted, and it immediately produces artifacts.

## Phase E — Voice, deploy, demo

| # | Component | Delivers | Test | Est. |
|---|---|---|---|---|
| 18 | **Transcribe (SLNG)** | `/v1/transcribe` adapter | `curl` with a Spanish sample `.wav` | 30 m |
| 19 | **Deploy** | Vercel ×2, Blob, env vars | Demo queries on the production URL | 45 m |
| 20 | **Demo hardening** | Demo script, mock-mode fallback, recorded backup video | 3 clean runs in a row | 45 m |

## Critical path and cut order

- **Critical path:** 01 → 02 → 03 → 04 → 05 → 07 → 08 → 09 → 11 → 12 (about 10 h). This alone is a working demo.
- **If time runs short, cut from the end of each phase:** 16 (Verify) → 18 (voice: use browser speech instead) → 10 (Rank: pick brands by filter score) → seed brands down to 5 (keep those Q1, Q3, Q9 and Q10 need) → 13–15 reduced to colours + voice only.
