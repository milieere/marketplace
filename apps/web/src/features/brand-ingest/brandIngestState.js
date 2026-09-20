// The brand agent always reports these five, in this order; the checklist shows them before they fire
export const INGEST_STEPS = [
  { id: "read", label: "Leyendo los documentos" },
  { id: "route", label: "Clasificando las páginas por tema" },
  { id: "extract", label: "Extrayendo marca, tono y ofertas" },
  { id: "normalize", label: "Normalizando al modelo de datos" },
  { id: "verify", label: "Comprobando la coherencia" },
];

export function createInitialIngestState(status = "idle") {
  return { status, steps: [], findings: [], record: null, errors: [] };
}

function upsertStep(steps, event) {
  const index = steps.findIndex((step) => step.id === event.id);
  if (index < 0) return [...steps, event];
  return steps.map((step, current) => (current === index ? { ...step, ...event } : step));
}

export function reduceIngestEvent(state, event) {
  switch (event.type) {
    case "step":
      return { ...state, steps: upsertStep(state.steps, event) };
    case "finding":
      return { ...state, findings: [...state.findings, event] };
    case "record":
      return { ...state, record: event.record };
    case "error":
      return { ...state, status: "error", errors: [...state.errors, event.message] };
    case "done":
      return { ...state, status: state.status === "error" ? "error" : "done" };
    default:
      return state;
  }
}

export function appendIngestError(state, error) {
  const message = error instanceof Error ? error.message : String(error);
  return { ...state, status: "error", errors: [...state.errors, message] };
}

export function checklist(steps) {
  const reported = new Map(steps.map((step) => [step.id, step]));
  const known = INGEST_STEPS.map(({ id, label }) => {
    const live = reported.get(id);
    reported.delete(id);
    return live ? { id, label: live.label, status: live.status, detail: live.detail } : { id, label, status: "pending" };
  });
  return [...known, ...reported.values()];
}

const GROUP_LABELS = {
  brand: "Marca",
  "brandKit.colors": "Colores",
  "brandKit.typography": "Tipografía",
  "brandKit.logos": "Logos",
  "brandKit.style": "Estilo",
  "brandKit.voice": "Tono de voz",
  "brandKit.imagery": "Dirección de imagen",
  "brandKit.photos": "Fotos",
  "brandKit.rules": "Reglas",
  locations: "Ubicaciones",
  offerings: "Ofertas",
  documents: "Documentos",
};

// finding.field is a path like brandKit.colors[terracotta].hex
export function findingGroup(field) {
  const parts = field.replace(/\[[^\]]*\]/g, "").split(".");
  return parts[0] === "brandKit" && parts[1] ? `brandKit.${parts[1]}` : parts[0];
}

export function groupLabel(group) {
  return GROUP_LABELS[group] || group;
}

export function groupFindings(findings) {
  const groups = new Map();
  for (const finding of findings) {
    const group = findingGroup(finding.field);
    const existing = groups.get(group);
    if (existing) existing.items.push(finding);
    else groups.set(group, { group, label: groupLabel(group), items: [finding] });
  }
  return [...groups.values()];
}
