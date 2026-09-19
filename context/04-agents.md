# Agents

**Status:** Draft. How the two agents work, piece by piece. The data they exchange is defined in [03-data-model.md](03-data-model.md); the raw inputs are in [05-brand-sources.md](05-brand-sources.md).

Both agents are **workflows with agentic loops where judgment is needed**. Fixed steps keep them fast and demo-safe, and the loops are where the LLM decides, checks itself and retries. Every step emits an `AgentEvent` that the UI streams.

```
            BRAND AGENT                                      CREATIVE AGENT
 brand source pack (PDFs, tokens, CSV, URL)          user query (voice → text)
   1 Read        documents → pages                     1 Understand  text → Intent (needs)    LLM
   2 Route       pages → topics              LLM       2 Filter      per need, + relaxation   code
   3 Extract     topic → partial record      LLM ×N    3 Combine     needs × budget           code
   4 Normalize   hex, fonts, vocabulary      code      4 Rank        top brands + offers      LLM
   5 Verify      conflicts, low confidence   LLM loop  5 Create      draft → check → revise   LLM loop
   6 Save        BrandRecord (draft)         code      6 Render      template + tokens → HTML code
                                                       (no match → NoMatch fallback page)
                        │                                          ▲
                        └──────── verified BrandRecord ───────────┘
```

## Brand Agent

**Goal:** a brand source pack in, a `BrandRecord` (`brand`, `brandKit` including tagged `photos`, `locations`, `offerings`, `documents`, `evidence`) out, with evidence for every field and status `draft`.

| Step | How | LLM? |
|---|---|---|
| **1 Read** | One `DocumentReader` per kind. **PDF** → text per page plus a PNG per page (the image shows layout, logo and colour roles; exact hex values come from the text layer or pixel sampling). **Photos** → image bytes for the tagger. **Structured** (design-tokens JSON, offers CSV) → parsed directly. **URL** → page text plus colours and fonts found in the site's CSS. | No |
| **2 Route** | Tag each page or chunk with topics: `identity`, `logo`, `color`, `typography`, `voice`, `imagery`, `rules`, `location`, `offers`. Each extractor then only sees relevant pages: smaller prompts and better accuracy. | Yes (cheap model) |
| **3 Extract** | One **extractor per topic**, run in parallel. Each gets its pages, a Zod schema, and the vocabulary where relevant (offers, locations, photos). It returns the partial record plus `Evidence` (page, quote, confidence). Page images go to the logo, colour-role and style extractors. **Photo tagger:** a vision model describes each brand photo and tags it with vocabulary values and `people`. | Yes |
| **4 Normalize** | **Hex values come from the PDF text layer, or from sampling pixels in code — never from a vision model** (tested: vision models misread #C8553D as #D2691E). Convert CMYK/RGB/Pantone to hex in code, compute contrast-safe `pairsWith` (WCAG), give each font a web fallback, map free-text attributes onto vocabulary values (synonyms first, then an LLM for leftovers), dedupe. | Mostly no |
| **5 Verify** *(agentic)* | Find conflicts (two different "primary" colours), low-confidence fields and missing required fields. For each one, the agent re-reads the specific pages with a targeted question. Maximum 2 rounds; anything still unresolved is flagged for human review. | Yes, loop |
| **6 Save** | Assemble the `BrandRecord`, validate it against the full schema, store it as `draft`. The review UI shows each field with its evidence, and the brand approves it (`verified`). | No |

**Structured beats unstructured.** If a design-tokens JSON (for example exported from Frontify or Figma) or an offers CSV exists, it is mapped deterministically and wins over PDF extraction. The PDF then only fills gaps, such as voice and imagery.

## Creative Agent

**Goal:** a query in; 2–3 personalized, on-brand HTML artifacts out, each with a trace and a check result. **If nothing fits, a `NoMatch` fallback page instead, never an empty screen.**

| Step | How | LLM? |
|---|---|---|
| **1 Understand** | Query text + vocabulary + current date/time → `Intent` (Zod). Classifies `scope`. Splits sequences ("dinner *and then* drinks") into up to 3 `needs`; alternatives ("dinner *or* drinks") stay one need. Hard needs go to `required`, nice-to-haves to `preferred`, the user's own words to `phrases`. `out-of-domain` → skip to the NoMatch page. | Yes |
| **2 Filter** | Per need, over verified records: required attributes, kinds, price within budget, open during `when`, party size fits. If a need has zero survivors, **relax** step by step (drop preferred → drop relaxable required → budget +20 % → time ±60 min; never dietary, accessibility or party size) and record each `Relaxation`. Pure and unit-tested. | No |
| **3 Combine** | Only when there are several needs: top 3 per need → combinations within the overall budget; a brand covering several needs becomes one candidate. Pure and unit-tested. | No |
| **4 Rank** | Candidates + intent → top N. For each one: which offers to feature, which location, the best-matching photo (from its tags and description), and a one-line rationale. Prefers single-brand combinations. | Yes |
| **5 Create** *(agentic, per brand, in parallel)* | The LLM gets the intent, the needs this brand answers, any relaxations (which must be stated honestly), the brand kit (voice, samples, rules, tone range) and the chosen offers. It returns an `ArtifactDraft`: format, tone, slots, badges, trace, and offer ids (never prices). `checkArtifact()` runs the brand rules plus grounding checks (offer ids exist, tone within range). If a `block` issue is found, the issues are fed back and the LLM revises, up to 3 rounds. The check result is always attached. | Yes, loop |
| **6 Render** | Copy `priceLines` from the offers. Fill a template (`banner` / `card`) with brand tokens, `style`, logo, fonts, the selected photo and the slots, producing self-contained HTML. Run the contrast check on the rendered colours. Store it and emit an `artifact` event. | No |

### When nothing matches

- **Out of domain** (Understand) or **still nothing after relaxing** (Filter): build a `NoMatch`.
- **Suggestions come from a near-miss analysis in code.** For each blocking constraint, re-run the filter without it and report how many results appear and at what price ("Raise budget to €22 pp → 2 options").
- **The fallback page** is rendered with the house brand kit (`data/brands/_house.json`). Suggestions are tappable and re-run the query with that change applied.
- It is emitted as a `no-match` event, and the stream then ends with `done`.

## Shared building blocks

```ts
interface Llm {
  structured<T>(req: { schema: ZodType<T>; system: string; messages: Message[]; images?: Uint8Array[] }): Promise<T>;
}
interface DocumentReader { read(doc: SourceDocument): Promise<Page[]> }          // Page = { n, text, image? }
interface SectionExtractor<T> { topic: Topic; extract(pages: Page[], ctx: ExtractCtx): Promise<Extracted<T>> }
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
- **Models are config per step** (routing: a small model; extraction and creation: a strong model; pages with images and photo tagging: a vision model), all served by Nebius Token Factory. Nebius has no image generation, so imagery is the brand's own tagged photos.

## Agent events (the UI timeline)

```ts
type AgentEvent =
  | { type: "step"; agent: "brand" | "creative"; id: string; label: string; status: "started" | "done" | "failed"; detail?: string }
  | { type: "finding"; field: string; value: unknown; evidence?: Evidence }   // brand agent: "Primary colour #C8553D (p.5)"
  | { type: "record"; record: BrandRecord }                                   // brand agent finished: the draft record
  | { type: "intent"; intent: Intent }
  | { type: "matches"; brands: { id: string; name: string; needIds: string[]; rationale: string }[] }
  | { type: "relaxed"; relaxations: Relaxation[] }                             // "No terrace tonight, looking wider…"
  | { type: "no-match"; noMatch: NoMatch }
  | { type: "revision"; brandId: string; issues: string[] }                   // creative agent self-correction, visible
  | { type: "artifact"; artifact: Artifact; html: string }
  | { type: "error"; message: string }
  | { type: "done" };
```

`finding` and `revision` are the most important events for the demo, because they make the agents' work visible.

## Models (Nebius Token Factory, tested 2026-09-19)

Test: 3 intent-parsing queries plus 1 guidelines-page extraction, with JSON-schema output requested.

| Model | Valid JSON | Intents correct | Avg. time (intent) | Brand extraction |
|---|---|---|---|---|
| **deepseek-ai/DeepSeek-V4-Pro** | 3/3 | 2/3 | **2.0 s** | correct, 1.9 s |
| **nvidia/nemotron-3-super-120b-a12b** | 3/3 | 2/3 | 3.6 s | correct, 4.9 s |
| deepseek-ai/DeepSeek-V4-Flash-0731 | 3/3 | 2/3 | 5.1 s | correct, 5.0 s |
| Qwen/Qwen3-30B-A3B-Instruct-2507 | 3/3 | 2/3 | 6.7 s | correct, 6.9 s |
| openai/gpt-oss-120b | 3/3 | 1/3 | 1.7 s | wrong |
| Qwen/Qwen3-235B-A22B-Instruct-2507 | 1/3 | 1/3 | 45.9 s | correct |
| GLM-5.3-Flash, DeepSeek-V4.1-Flash, Nemotron-3.5-Lightning, Kimi-K2.6, Gemma-3-27b | unreliable or slow | | | |

**Picks:**
- **Default for every text step:** `deepseek-ai/DeepSeek-V4-Pro`, with `nvidia/nemotron-3-super-120b-a12b` as the fallback.
- **Vision** (photo tagging, page roles): `google/gemma-3-27b-it` or `openbmb/MiniCPM-V-4_5`. Both can read images but misread exact colours, and Gemma is slow with JSON schemas. Test both on real pages.

**Lessons for `Llm.structured`:**
- **JSON schema is requested but not enforced.** Several models returned malformed or empty JSON, so always validate with Zod, retry once with the validation error, then fall back to the next model.
- **Never let an LLM convert colours.** DeepSeek-V4-Pro converted CMYK `15 0 46 58` to `#6B8E23`; the correct value is `#5B6B3A`. Do it in code.
- **Intent prompts need worked examples.** Most models missed one case (for example counting "two adults and two kids + grandma" as 5), so add few-shot examples to the prompt.
