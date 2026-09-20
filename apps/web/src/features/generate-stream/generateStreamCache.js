const CACHE_PREFIX = "oli:generate:";
const CACHE_VERSION = 5;

function cacheKey(query) {
  return `${CACHE_PREFIX}${CACHE_VERSION}:${query.trim().toLowerCase()}`;
}

export function normalizeGenerateQuery(query) {
  return query.trim().toLowerCase();
}

export function clearGenerateCache() {
  if (typeof window === "undefined") return;
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(CACHE_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // localStorage can fail in private browsing or when quota is locked.
  }
}

export function readGenerateCache(query) {
  if (typeof window === "undefined" || !query) return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(query));
    if (!raw) return null;
    const cached = JSON.parse(raw);
    return cached?.state || null;
  } catch {
    return null;
  }
}

export function writeGenerateCache(query, state) {
  if (typeof window === "undefined" || !query) return;
  if (!state.artifacts.length && !state.noMatch) return;

  try {
    window.localStorage.setItem(
      cacheKey(query),
      JSON.stringify({
        version: CACHE_VERSION,
        query,
        savedAt: new Date().toISOString(),
        state,
      }),
    );
  } catch {
    // localStorage can fail in private browsing or when quota is full.
  }
}
