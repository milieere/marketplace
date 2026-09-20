export const DETAIL_KEY = "oli:selectedArtifactDetail";

export function saveAdDetail({ artifact, html, visual }) {
  if (typeof window === "undefined" || !artifact) return;
  const detail = { artifact, html, visual, savedAt: new Date().toISOString() };
  window.sessionStorage.setItem(`${DETAIL_KEY}:${artifact.id}`, JSON.stringify(detail));
  window.sessionStorage.setItem(DETAIL_KEY, JSON.stringify(detail));
}

export function readAdDetail(id) {
  const raw = readAdDetailRaw(id);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return parsed?.artifact?.id === id || parsed?.artifact ? parsed : null;
}

export function readAdDetailRaw(id) {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(`${DETAIL_KEY}:${id}`) || window.sessionStorage.getItem(DETAIL_KEY);
}
