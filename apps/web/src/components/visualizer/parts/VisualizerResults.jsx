import CardView from "../../cardView/cardView";
import StreamingLoading from "../../streamingLoading/StreamingLoading";
import styles from "../visualizer.module.css";

function artifactVisualStatus(state, artifact) {
  return state.steps.findLast((step) => step.id === `visual-${artifact.brandId}`)?.status;
}

// Hold the studio until every visual lands, so no card shows half-built
function visualsSettled(state) {
  if (state.status !== "loading") return true;
  if (!state.artifacts.length) return false;
  return state.artifacts.every(
    ({ artifact }) => state.visuals?.[artifact.id] || artifactVisualStatus(state, artifact) === "failed",
  );
}

export default function VisualizerResults({ query, state }) {
  const settled = visualsSettled(state);
  const hasArtifacts = settled && state.artifacts.length > 0;

  return (
    <div className={`${styles.results} ${hasArtifacts ? styles.resultsGrid : styles.resultsSingle}`}>
      {state.noMatch && (
        <CardView
          title={state.noMatch.message}
          subtitle={state.noMatch.reason}
          html={state.noMatch.html}
          suggestions={state.noMatch.suggestions}
        />
      )}

      {settled &&
        state.artifacts.map(({ artifact, html }) => (
          <CardView
            key={artifact.id}
            title={artifact.slots.headline}
            subtitle={artifact.slots.subline || artifact.brandId}
            artifact={artifact}
            html={html}
            visual={state.visuals?.[artifact.id]}
            visualStatus={artifactVisualStatus(state, artifact)}
            isGenerating={state.status === "loading"}
          />
        ))}

      {!query && <CardView title="Sin consulta" subtitle="Vuelve al inicio y genera una búsqueda para ver el stream." />}

      {query && state.status === "loading" && !settled && !state.noMatch && (
        <StreamingLoading title="Materializando soluciones" state={state} />
      )}
    </div>
  );
}
