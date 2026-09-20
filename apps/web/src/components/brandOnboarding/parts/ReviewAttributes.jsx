import styles from "../brandOnboarding.module.css";

export default function ReviewAttributes({ attributes }) {
  const entries = Object.entries(attributes || {}).filter(([, values]) => values?.length);
  if (!entries.length) return null;

  return (
    <ul className={styles.tags}>
      {entries.map(([key, values]) => (
        <li key={key}>
          <span className={styles.tagKey}>{key}</span> {values.join(", ")}
        </li>
      ))}
    </ul>
  );
}
