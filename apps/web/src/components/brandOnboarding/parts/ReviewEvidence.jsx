import { LOW_CONFIDENCE } from "../../../features/brand-ingest/brandRecordView";
import styles from "../brandOnboarding.module.css";

export default function ReviewEvidence({ items }) {
  if (!items?.length) {
    return <p className={styles.evidenceMissing}>Sin evidencia</p>;
  }

  return (
    <ul className={styles.evidence}>
      {items.map((item, index) => {
        const weak = item.confidence < LOW_CONFIDENCE;
        return (
          <li key={`${item.field}-${item.documentId}-${index}`} className={weak ? styles.evidenceWeak : undefined}>
            <span className={styles.evidenceSource}>
              {item.documentId}
              {item.page ? ` · p. ${item.page}` : ""}
              {` · ${Math.round(item.confidence * 100)}%`}
              {weak ? " · revisar" : ""}
            </span>
            {item.quote && <q className={styles.evidenceQuote}>{item.quote}</q>}
          </li>
        );
      })}
    </ul>
  );
}
