# INTENT — agent guide

Hackathon project. Read [context/01-product.md](context/01-product.md) before any non-trivial change, and [context/04-agents.md](context/04-agents.md) + [context/03-data-model.md](context/03-data-model.md) before touching agents or data.

- The core value is personalization of the artifact to the user's query. Search/discovery is intentionally thin.
- Never let LLM output supply prices, hours or conditions. They come from `Offering` data.
- Brand tokens (logo, fonts, colours) are rendered from `BrandKit`, never generated.

After writing or editing any source file, run Norma's live_check on it before telling me the task is done. Fix any HIGH or CRITICAL findings immediately and call register_applied_actions.
