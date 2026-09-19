import styles from "../visualizer.module.css";

function getStatusLabel(status, latestStep) {
  if (status === "loading" && latestStep) return latestStep.label;
  if (status === "done") return "Generación completada";
  if (status === "error") return "No se pudo completar la generación";
  return "Esperando consulta";
}

function IntentSummary({ intent }) {
  if (!intent) return null;

  return (
    <div className={styles.panel}>
      <h2>Entendido</h2>
      <p>{intent.needs.map((need) => need.label).join(", ") || intent.scope}</p>
      {intent.budget && (
        <span>
          €{intent.budget.amount} / {intent.budget.per}
        </span>
      )}
    </div>
  );
}

function Timeline({ steps }) {
  return (
    <div className={styles.panel}>
      <h2>Timeline</h2>
      <ul className={styles.steps}>
        {steps.map((step) => (
          <li key={step.id} data-status={step.status}>
            <strong>{step.label}</strong>
            {step.detail && <span>{step.detail}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Matches({ matches }) {
  if (!matches.length) return null;

  return (
    <div className={styles.panel}>
      <h2>Matches</h2>
      <ul className={styles.matches}>
        {matches.map((brand) => (
          <li key={brand.id}>
            <strong>{brand.name}</strong>
            <span>{brand.rationale}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Revisions({ revisions }) {
  if (!revisions.length) return null;

  return (
    <div className={styles.panel}>
      <h2>Revisiones</h2>
      {revisions.map((revision) => (
        <p key={`${revision.brandId}-${revision.issues.join("-")}`}>
          {revision.brandId}: {revision.issues.join(", ")}
        </p>
      ))}
    </div>
  );
}

export default function VisualizerSidebar({ query, state, latestStep }) {
  return (
    <aside className={styles.sidebar}>
      <p className={styles.eyebrow}>Intent request</p>
      <h1>{query || "Escribe una idea para generar opciones"}</h1>
      <p className={styles.status}>{getStatusLabel(state.status, latestStep)}</p>

      <IntentSummary intent={state.intent} />
      <Timeline steps={state.steps} />
      <Matches matches={state.matches} />
      <Revisions revisions={state.revisions} />

      {state.errors.map((error) => (
        <p className={styles.error} key={error}>
          {error}
        </p>
      ))}
    </aside>
  );
}
