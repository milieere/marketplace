# INTENT — agent guide

Hackathon project. **Current work and next step: [context/07-build-plan.md](context/07-build-plan.md)** (start there in a new session). Read [context/01-product.md](context/01-product.md) before any non-trivial change, and [context/04-agents.md](context/04-agents.md) + [context/03-data-model.md](context/03-data-model.md) before touching agents or data. Repo layout and boundaries: [context/06-architecture.md](context/06-architecture.md).

## Commands (from the repo root)

- `npm install`: installs all workspaces
- `npm run dev:api`: Hono API on :8787 (reads `.env`)
- `npm run dev:web`: Next.js frontend on :3000
- `npm run typecheck`, `npm test`, `npm run lint`

## Rules

- Frontend (`apps/web`) is JavaScript; backend (`apps/api`) and `packages/contracts` are TypeScript.
- Each app declares its own dependencies. `packages/` holds only code shared by both apps (today: `contracts`).
- The backend lives in `apps/api`, never in Next.js route handlers.
- In `apps/api`, agents depend on ports, never on adapters; only the composition root wires adapters.
- No barrel files: packages expose files through an `exports` map.
- Tests live in a `test/` folder next to `src/`, mirroring its structure (`src/http/app.ts` → `test/http/app.test.ts`); never inside `src/`.
- The core value is personalization of the artifact to the user's query. Search/discovery is intentionally thin.
- Never let LLM output supply prices, hours or conditions. They come from `Offering` data.
- Brand tokens (logo, fonts, colours) are rendered from `BrandKit`, never generated.
