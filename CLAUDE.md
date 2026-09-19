# INTENT — agent guide

Hackathon project. Read [context/01-product.md](context/01-product.md) before any non-trivial change, and [context/03-system.md](context/03-system.md) before touching agents or data.

- The core value is personalization of the artifact to the user's query. Search/discovery is intentionally thin.
- Never let LLM output supply prices, hours or conditions. They come from `Offering` data.
- Brand tokens (logo, fonts, colours) are rendered from `BrandKit`, never generated.
