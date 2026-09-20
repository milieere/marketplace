# INTENT — agent guide

Hackathon project. **Current work and next step: [context/07-build-plan.md](context/07-build-plan.md)** (start there in a new session). Read [context/01-product.md](context/01-product.md) before any non-trivial change, and [context/04-agents.md](context/04-agents.md) + [context/03-data-model.md](context/03-data-model.md) before touching agents or data. Repo layout and boundaries: [context/06-architecture.md](context/06-architecture.md).

## Commands (from the repo root)

- `npm install`: installs all workspaces
- `npm run dev:api`: Hono API on :8787 (reads `.env`)
- `npm run dev:web`: Next.js frontend on :3000
- `npm run build:logos`: rasterizes the SVG brand marks to PNG for the image model
- `npm run design:samples`: one designed card per brand into `out/designs/` (text model only, no image credit)
- `npm run visual:samples`: one generated scene per brand into `out/visuals/` (costs fal credit)
- `npm run demo:pitch`: one brand answering four different queries, through the live agent
- `npm run typecheck`, `npm test`, `npm run lint`

## Rules

- Frontend (`apps/web`) is JavaScript; backend (`apps/api`) and `packages/contracts` are TypeScript.
- Each app declares its own dependencies. `packages/` holds only code shared by both apps (today: `contracts`).
- The backend lives in `apps/api`, never in Next.js route handlers.
- In `apps/api`, agents depend on ports, never on adapters; only the composition root wires adapters.
- No barrel files: packages expose files through an `exports` map.
- Tests live in a `test/` folder next to `src/`, mirroring its structure (`src/http/app.ts` → `test/http/app.test.ts`); never inside `src/`.
- The core value is personalization of the artifact to the user's query. Search/discovery is intentionally thin.
- Prices, hours and conditions are never authored by a model. They come from `Offering`/`Location` data and are rendered as real DOM text, never drawn by the image model.
- Brand tokens come from `BrandKit` and are never invented. The card renders them exactly.
- The image model draws a photograph and nothing else: no text, no logo, no price (`VISUAL_MODE=scene`). `full-card` and `background` exist for comparison but are not the default.
- The model art-directs, code lays out. `agents/creative/design.ts` asks for a small set of tokens (anchor, scrim, type scale, palette assignments, price treatment); `templates/card-style.ts` turns them into CSS. Geometry stays in code so a card cannot clip, collapse or hide its photograph — never widen the token schema into free-form CSS.
- `templates/card-shell.ts` owns the markup and `card-style.ts` the generated rules, and both scope selectors as `.card .x`. A rule written as `.x` loses to the shell's reset on specificity.
