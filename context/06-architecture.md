# Architecture

**Status:** Draft. How the code is organised. What the agents do is in [04-agents.md](04-agents.md), the data they exchange is in [03-data-model.md](03-data-model.md).

## Repo structure

pnpm monorepo, TypeScript everywhere.

```
apps/
  api/                Hono backend: both agents, HTTP + SSE        (BE owner)
  web/                Next.js frontend                             (FE owner)
packages/
  contracts/          Zod schemas shared by api and web: requests, AgentEvent, Artifact summary
data/
  vocabularies/       per-industry attribute vocabularies (hospitality.json)
  brands/             BrandRecord JSON, one per brand (the demo "database")
  sources/<brand>/    brand source packs: PDFs, logos, photos, expected.json (extraction answer key)
scripts/              build-sources (HTML → PDF), eval-extraction, eval-intents
context/              product and design docs (this folder)
```

**Only `packages/contracts` is shared.** `web` never imports from `api`, and `api` never imports from `web`.

## Backend layout (`apps/api/src`)

Ports and adapters. The dependency direction always points inward: `http → agents → ports ← adapters`, with `domain` at the centre.

```
domain/             pure types (Zod) and pure functions, no I/O
  brand-record.ts   Brand, BrandKit, Venue, Offering, Photo, Evidence
  intent.ts
  artifact.ts
  vocabulary.ts     load + validate attributes against a vocabulary
  filter.ts         hard-constraint matching (budget, hours, party, attributes)
  check.ts          brand-rule checks on a draft/rendered artifact
  color.ts          CMYK/RGB → hex, WCAG contrast
ports/              interfaces only
  llm.ts            structured<T>(schema, prompt, images?) → T
  document-reader.ts
  brand-repository.ts
  blob-store.ts
  speech-to-text.ts
  agent-events.ts
adapters/           one folder per external system, implements ports
  nebius/           NebiusLlm (OpenAI SDK, baseURL Token Factory; validate → retry → fallback model)
  slng/             SlngSpeechToText (UNMUTE STT bridge)
  pdf/              PdfReader (text layer per page + page PNGs)
  fs/               JsonBrandRepository, LocalBlobStore
  vercel/           VercelBlobStore
agents/
  brand/            read.ts, route.ts, extractors/<topic>.ts, normalize.ts, verify.ts, brand-agent.ts
  creative/         understand.ts, rank.ts, create.ts, render.ts, creative-agent.ts
templates/          banner.ts, card.ts: (spec, brandKit) → HTML string, pure
prompts/            one .md per LLM step (understand, rank, create, extract-<topic>, verify, tag-photo)
http/
  app.ts            Hono app, CORS, error handler
  routes/           generate.ts (SSE), brands.ts (ingest SSE, list, get, verify), artifacts.ts, transcribe.ts
config.ts           env parsed with Zod, fail fast
container.ts        composition root: builds adapters from config, injects them into agents
index.ts            node server entry (dev); Vercel entry exports the app
```

**Rules:**
- **Agents depend on ports, never on adapters.** `container.ts` is the only file that imports concrete adapters.
- **Constructor injection, no DI framework.** Each agent step is a small class or function that receives only the ports it needs.
- **Domain is pure.** Filter, checks, colour maths and templates are deterministic and unit-tested. The LLM steps are thin: a prompt, a schema, and one call through `Llm`.
- **Extension points:**
  - new source type → new `DocumentReader`
  - new brand topic → new extractor in `agents/brand/extractors/`
  - new artifact format → new template
  - new industry → new vocabulary file
  - new provider → new adapter
- **No barrel files.** Import from the specific file.

## API

Defined in `packages/contracts`, served by `apps/api`.

| Method | Path | Returns |
|---|---|---|
| `POST` | `/v1/generate` `{ text, now?, timezone?, format? }` | SSE stream of `AgentEvent`: `step`, `intent`, `matches`, `revision`, `artifact`, `error`, `done` |
| `POST` | `/v1/brands/ingest` (multipart source files) | SSE stream of `AgentEvent`: `step`, `finding`, then the draft `BrandRecord` |
| `GET` | `/v1/brands` | brand summaries (id, name, logo, status) |
| `GET` | `/v1/brands/:id` | full `BrandRecord` (for the review screen) |
| `POST` | `/v1/brands/:id/verify` | marks the record `verified` |
| `GET` | `/v1/artifacts/:id` | the artifact's standalone HTML (share link) |
| `POST` | `/v1/transcribe` (multipart audio) | `{ text }` |
| `GET` | `/assets/*` | logos and photos from `data/sources` |

- **The frontend renders artifacts** with `<iframe srcdoc={html} sandbox>`, so brand CSS can't leak into the app.
- **A mock mode** (`MOCK=1`) makes `/v1/generate` and `/v1/brands/ingest` replay recorded event streams. The frontend can build against it before the agents exist, and it doubles as the demo fallback.

## Configuration

`.env`, validated in `config.ts`:

```
NEBIUS_API_KEY, NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1
MODEL_TEXT=deepseek-ai/DeepSeek-V4-Pro, MODEL_TEXT_FALLBACK=nvidia/nemotron-3-super-120b-a12b, MODEL_VISION=google/gemma-3-27b-it
SLNG_API_KEY, SLNG_STT_MODEL=deepgram/nova:3
BLOB_READ_WRITE_TOKEN   (prod only; local blob store otherwise)
MOCK=0
```

## Testing

| Level | What | How |
|---|---|---|
| Unit | `domain/*`, templates | vitest, no network |
| Extraction eval | Brand Agent on `data/sources/casa-brisa/` vs. `expected.json` | `pnpm eval:extraction`: field-by-field score |
| Intent eval | ~10 golden queries → expected `Intent` fields | `pnpm eval:intents`: pass/fail per query |
| End to end | `curl -N /v1/generate` with the demo queries | manual, before the demo |

## Deployment

Vercel, two projects from the monorepo: `apps/web` and `apps/api` (Hono runs on Vercel Functions, and SSE streams work there). Artifacts go to Vercel Blob. Brand records and source packs are bundled with the API. There is no database for the demo; `BrandRepository` and `BlobStore` are the seams for adding one later.
