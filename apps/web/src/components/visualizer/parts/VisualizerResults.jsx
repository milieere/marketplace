import CardView from "../../cardView/cardView";
import StreamingLoading from "../../streamingLoading/StreamingLoading";
import styles from "../visualizer.module.css";

function artifactVisualStatus(state, artifact) {
  return state.steps.findLast((step) => step.id === `visual-${artifact.brandId}`)?.status;
}

export default function VisualizerResults({ query, state }) {
  const hasArtifacts = state.artifacts.length > 0;

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

      {state.artifacts.map(({ artifact, html }) => (
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

      {query && state.status === "loading" && state.artifacts.length === 0 && !state.noMatch && (
        <StreamingLoading title="Materializando soluciones" state={state} />
      )}
    </div>
  );
}
