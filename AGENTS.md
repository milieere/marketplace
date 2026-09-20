# INTENT — agent guide

Hackathon project. **Current work and next step: [context/07-build-plan.md](context/07-build-plan.md)** (start there in a new session). Read [context/01-product.md](context/01-product.md) before any non-trivial change, and [context/04-agents.md](context/04-agents.md) + [context/03-data-model.md](context/03-data-model.md) before touching agents or data. Repo layout and boundaries: [context/06-architecture.md](context/06-architecture.md).

## Commands (from the repo root)

- `npm install`: installs all workspaces
- `npm run dev:api`: Hono API on :8787 (reads `.env`)
- `npm run dev:web`: Next.js frontend on :3000
- `npm run build:logos`: rasterizes the SVG brand marks to PNG for the image model
- `npm run visual:samples`: one generated card per brand into `out/visuals/` (costs fal credit)
- `npm run typecheck`, `npm test`, `npm run lint`

## Rules

- Frontend (`apps/web`) is JavaScript; backend (`apps/api`) and `packages/contracts` are TypeScript.
- Each app declares its own dependencies. `packages/` holds only code shared by both apps (today: `contracts`).
- The backend lives in `apps/api`, never in Next.js route handlers.
- In `apps/api`, agents depend on ports, never on adapters; only the composition root wires adapters.
- No barrel files: packages expose files through an `exports` map.
- Tests live in a `test/` folder next to `src/`, mirroring its structure (`src/http/app.ts` → `test/http/app.test.ts`); never inside `src/`.
- The core value is personalization of the artifact to the user's query. Search/discovery is intentionally thin.
- Prices, hours and conditions are never authored by a model. They come from `Offering`/`Location` data and are passed verbatim to whatever renders them. In `VISUAL_MODE=full-card` the image model transcribes them; the HTML card stays the grounded rendering and the fallback.
- Brand tokens come from `BrandKit` and are never invented. The HTML card renders them exactly. The image model receives them as explicit hex values, named typefaces and the logo as a reference image, and must reproduce rather than reinterpret them.
- Two renderers, one design. `templates/card.ts` (HTML) and `templates/card-prompt.ts` (image) both derive from `cardDesign(kit)` and the shared tables in `card.ts`. Never make a layout, colour or contrast decision in one without the other.
