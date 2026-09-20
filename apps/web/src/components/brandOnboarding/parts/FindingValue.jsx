import styles from "../brandOnboarding.module.css";

const HEX = /^#[0-9A-F]{6}$/i;

function scalarText(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// finding.value is unknown: a hex, a list or an object depending on the field
export default function FindingValue({ value }) {
  if (typeof value === "string" && HEX.test(value)) {
    return (
      <span className={styles.swatch}>
        <span className={styles.swatchChip} style={{ background: value }} aria-hidden="true" />
        <code>{value.toUpperCase()}</code>
      </span>
    );
  }

  if (Array.isArray(value)) {
    return (
      <ul className={styles.valueList}>
        {value.map((item, index) => (
          <li key={index}>{scalarText(item)}</li>
        ))}
      </ul>
    );
  }

  if (value && typeof value === "object") {
    return (
      <dl className={styles.valueObject}>
        {Object.entries(value).map(([key, entry]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{scalarText(entry)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return <span className={styles.valueScalar}>{scalarText(value)}</span>;
}
