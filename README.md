# INTENT

> Every brand message, personalized to what this one person just asked for, and still 100% on-brand.

## 👉 Start here

| Read | What it covers |
|---|---|
| ⭐ **[context/01-product.md](context/01-product.md)** | The idea, where the value is, the two agents, the demo. **Read this first.** |
| [context/02-use-cases.md](context/02-use-cases.md) | Example user queries and brand inputs |
| [context/03-data-model.md](context/03-data-model.md) | The contract between the two agents |
| [context/04-agents.md](context/04-agents.md) | How the Brand Agent and Creative Agent work, step by step |
| [context/05-brand-sources.md](context/05-brand-sources.md) | Raw brand materials (PDFs, tokens, offers) the Brand Agent reads |
| [context/06-architecture.md](context/06-architecture.md) | Repo structure, backend layout, API, config, testing, deploy |
| [context/07-build-plan.md](context/07-build-plan.md) | Component-by-component build order, each tested and reviewed separately |

## Setup

```bash
npm install
cp .env.example .env          # add NEBIUS_API_KEY (or set MOCK=1)
npm run dev:api               # http://localhost:8787/health
npm run dev:web               # http://localhost:3000
npm test
```

See [AGENTS.md](AGENTS.md) for conventions and [context/06-architecture.md](context/06-architecture.md) for the layout.
