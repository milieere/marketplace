export const INITIAL_GENERATE_STATE = {
  status: "idle",
  steps: [],
  intent: null,
  matches: [],
  artifacts: [],
  visuals: {},
  relaxations: [],
  revisions: [],
  noMatch: null,
  errors: [],
};

export function createInitialGenerateState(status = "idle") {
  return { ...INITIAL_GENERATE_STATE, status };
}

function upsertStep(steps, nextStep) {
  const index = steps.findIndex((step) => step.id === nextStep.id);
  if (index < 0) return [...steps, nextStep];
  return steps.map((step, currentIndex) => (currentIndex === index ? { ...step, ...nextStep } : step));
}

export function reduceGenerateEvent(state, event) {
  switch (event.type) {
    case "step":
      return { ...state, steps: upsertStep(state.steps, event) };
    case "intent":
      return { ...state, intent: event.intent };
    case "matches":
      return { ...state, matches: event.brands };
    case "relaxed":
      return { ...state, relaxations: [...state.relaxations, ...event.relaxations] };
    case "revision":
      return { ...state, revisions: [...state.revisions, event] };
    case "artifact": {
      const nextArtifact = { artifact: event.artifact, html: event.html };
      const exists = state.artifacts.some((item) => item.artifact.id === event.artifact.id);
      return {
        ...state,
        artifacts: exists ? state.artifacts.map((item) => (item.artifact.id === event.artifact.id ? nextArtifact : item)) : [...state.artifacts, nextArtifact],
      };
    }
    case "visual":
      return { ...state, visuals: { ...state.visuals, [event.artifactId]: event } };
    case "no-match":
      return { ...state, noMatch: event.noMatch };
    case "error":
      return { ...state, errors: [...state.errors, event.message] };
    case "done":
      return { ...state, status: "done" };
    default:
      return state;
  }
}

export function appendGenerateError(state, error) {
  const message = error instanceof Error ? error.message : String(error);
  return { ...state, status: "error", errors: [...state.errors, message] };
}

export function getLatestStep(steps) {
  const active = steps.findLast((step) => step.status === "started");
  return active || steps.at(-1);
}
