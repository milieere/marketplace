import styles from "./cardView.module.css";

export default function CardView({ title, subtitle, artifact, html, suggestions = [] }) {
  return (
    <article className={styles.cardView}>
      <header className={styles.cardHeader}>
        <div>
          <p>{subtitle}</p>
          <h2>{title}</h2>
        </div>
        {artifact?.check && <span data-passed={artifact.check.passed}>{artifact.check.passed ? "Check passed" : "Needs review"}</span>}
      </header>

      {html ? (
        <iframe className={styles.preview} title={title} srcDoc={html} sandbox="allow-popups" />
      ) : (
        <div className={styles.emptyPreview}>Esperando artifact</div>
      )}

      {artifact && (
        <footer className={styles.meta}>
          <div>
            <strong>{artifact.brandId}</strong>
            <span>{artifact.format}</span>
          </div>
          <ul>
            {artifact.slots.badges.map((badge) => (
              <li key={badge}>{badge}</li>
            ))}
          </ul>
        </footer>
      )}

      {suggestions.length > 0 && (
        <div className={styles.suggestions}>
          {suggestions.map((suggestion) => (
            <button key={suggestion.label} type="button">
              {suggestion.label}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
