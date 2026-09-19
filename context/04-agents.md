# Agents

**Status:** Draft. How the two agents work, piece by piece. The data they exchange is defined in [03-data-model.md](03-data-model.md); the raw inputs are in [05-brand-sources.md](05-brand-sources.md).

Both agents are **workflows with agentic loops where judgment is needed**. Fixed steps keep them fast and demo-safe, and the loops are where the LLM decides, checks itself and retries. Every step emits an `AgentEvent` that the UI streams.

```
            BRAND AGENT                                      CREATIVE AGENT
 brand source pack (PDFs, tokens, CSV, URL)          user query (voice → text)
   1 Read        documents → pages                     1 Understand  text → Intent            LLM
   2 Route       pages → topics              LLM       2 Filter      hard constraints        code
   3 Extract     topic → partial record      LLM ×N    3 Rank        top brands + offers      LLM
   4 Normalize   hex, fonts, vocabulary      code      4 Create      per brand: draft → check  LLM loop
   5 Verify      conflicts, low confidence   LLM loop                 → revise
   6 Save        BrandRecord (draft)         code      5 Render      template + tokens → HTML  code
                        │                                          ▲
                        └──────── verified BrandRecord ───────────┘
```

## Brand Agent

**Goal:** a brand source pack in, a `BrandRecord` (`brand`, `brandKit`, `venues`, `offerings`, `documents`) out, with evidence for every field and status `draft`.

| Step | How | LLM? |
|---|---|---|
| **1 Read** | One `DocumentReader` per kind. **PDF** → text per page plus a PNG per page (vision models read colour swatches and logo pages better than text). **Structured** (design-tokens JSON, offers CSV) → parsed directly. **URL** → page text plus colours and fonts found in the site's CSS. | No |
| **2 Route** | Tag each page or chunk with topics: `identity`, `logo`, `color`, `typography`, `voice`, `imagery`, `rules`, `venue`, `offers`. Each extractor then only sees relevant pages: smaller prompts and better accuracy. | Yes (cheap model) |
| **3 Extract** | One **extractor per topic**, run in parallel. Each gets its pages, a Zod schema, and the vocabulary where relevant (offers, venues). It returns the partial record plus `Evidence` (page, quote, confidence). Vision pages go to colour, logo and imagery. | Yes |
| **4 Normalize** | Convert CMYK/RGB/Pantone to hex, compute contrast-safe `pairsWith` (WCAG), give each font a web fallback, map free-text attributes onto vocabulary values (synonyms first, then an LLM for leftovers), dedupe. | Mostly no |
| **5 Verify** *(agentic)* | Find conflicts (two different "primary" colours), low-confidence fields and missing required fields. For each one, the agent re-reads the specific pages with a targeted question. Maximum 2 rounds; anything still unresolved is flagged for human review. | Yes, loop |
| **6 Save** | Assemble the `BrandRecord`, validate it against the full schema, store it as `draft`. The review UI shows each field with its evidence, and the brand approves it (`verified`). | No |

**Structured beats unstructured.** If a design-tokens JSON (for example exported from Frontify or Figma) or an offers CSV exists, it is mapped deterministically and wins over PDF extraction. The PDF then only fills gaps, such as voice and imagery.

## Creative Agent

**Goal:** a query in; 2–3 personalized, on-brand HTML artifacts out, each with a trace and a check result.

| Step | How | LLM? |
|---|---|---|
| **1 Understand** | Query text + vocabulary + current date/time → `Intent` (Zod). Hard needs go to `required`, nice-to-haves to `preferred`, and the user's own words to `phrases`. | Yes |
| **2 Filter** | Over verified records: required attributes present, price within budget, open during `when`, party size fits. It is pure and unit-tested; if nothing survives, retry once with `preferred` only and say so in the trace. | No |
| **3 Rank** | Survivors + intent → top N brands. For each one: which offers to feature, which venue, and a one-line rationale. | Yes |
| **4 Create** *(agentic, per brand, in parallel)* | The LLM gets the intent, the brand kit (voice, samples, rules, tone range) and the chosen offers. It returns an `ArtifactDraft`: format, tone, slots, badges, image prompt, trace, and offer ids (never prices). `checkArtifact()` runs the brand rules plus grounding checks (offer ids exist, tone within range). If a `block` issue is found, the issues are fed back and the LLM revises, up to 3 rounds. The check result is always attached. | Yes, loop |
| **5 Render** | Generate the image (scene only; fallback gradient in brand colours). Copy `priceLines` from the offers. Fill a template (`banner` / `card`) with brand tokens, logo, fonts and slots, producing self-contained HTML. Store it and emit an `artifact` event. | Image model only |

## Shared building blocks

```ts
interface Llm {
  structured<T>(req: { schema: ZodType<T>; system: string; messages: Message[]; images?: Uint8Array[] }): Promise<T>;
}
interface DocumentReader { read(doc: SourceDocument): Promise<Page[]> }          // Page = { n, text, image? }
interface SectionExtractor<T> { topic: Topic; extract(pages: Page[], ctx: ExtractCtx): Promise<Extracted<T>> }
interface ImageGenerator { generate(prompt: string, size: Size): Promise<Uint8Array> }
interface BrandRepository { list(): Promise<BrandRecord[]>; get(id: string): Promise<BrandRecord>; save(r: BrandRecord): Promise<void> }
interface BlobStore { put(key: string, data: Uint8Array | string, type: string): Promise<string> }
interface AgentEvents { emit(e: AgentEvent): void }
```

- **Extensibility:**
  - A new source type (Frontify, Figma) is a new `DocumentReader` or a structured mapper.
  - A new brand topic is a new `SectionExtractor`.
  - A new format is a new template.
  - A new industry is a new vocabulary file.
  - The agents themselves stay unchanged.
- **Prompts** live in `apps/api/src/prompts/*.md`, one per LLM step, so they can be iterated without touching code.
- **Models are config per step** (routing: a small model; extraction and creation: a strong model; pages with images: a vision model), all served by Nebius Token Factory.

## Agent events (the UI timeline)

```ts
type AgentEvent =
  | { type: "step"; agent: "brand" | "creative"; id: string; label: string; status: "started" | "done" | "failed"; detail?: string }
  | { type: "finding"; field: string; value: unknown; evidence?: Evidence }   // brand agent: "Primary colour #C8553D (p.5)"
  | { type: "intent"; intent: Intent }
  | { type: "matches"; brands: { id: string; name: string; rationale: string }[] }
  | { type: "revision"; brandId: string; issues: string[] }                   // creative agent self-correction, visible
  | { type: "artifact"; artifact: Artifact; html: string }
  | { type: "error"; message: string }
  | { type: "done" };
```

`finding` and `revision` are the most important events for the demo, because they make the agents' work visible.
