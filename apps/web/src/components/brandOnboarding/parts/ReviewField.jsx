import { evidenceFor } from "../../../features/brand-ingest/brandRecordView";
import styles from "../brandOnboarding.module.css";
import ReviewEvidence from "./ReviewEvidence";

export default function ReviewField({ path, label, index, inputId, issues = [], children }) {
  const Label = inputId ? "label" : "span";

  return (
    <div className={`${styles.field} ${issues.length ? styles.fieldFlagged : ""}`}>
      <Label className={styles.fieldLabel} htmlFor={inputId}>
        {label}
      </Label>
      <div className={styles.fieldValue}>{children}</div>
      <ReviewEvidence items={evidenceFor(index, path)} />
      {issues.map((issue) => (
        <p key={issue} className={styles.fieldIssue}>
          {issue}
        </p>
      ))}
    </div>
  );
}
