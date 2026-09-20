"use client";

import { useEffect, useState } from "react";
import { checklist, groupFindings } from "../../../features/brand-ingest/brandIngestState";
import styles from "../brandOnboarding.module.css";
import FindingValue from "./FindingValue";
import ReviewEvidence from "./ReviewEvidence";

const VISIBLE_PER_GROUP = 6;

function useElapsed(running) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) return undefined;
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [running]);

  return seconds;
}

function FindingGroup({ group }) {
  const [expanded, setExpanded] = useState(false);
  const hidden = group.items.length - VISIBLE_PER_GROUP;
  // Newest first: on a long run the interesting finding is the one that just landed
  const items = [...group.items].reverse();
  const shown = expanded ? items : items.slice(0, VISIBLE_PER_GROUP);

  return (
    <section className={styles.findingGroup}>
      <h3>
        {group.label}
        <span className={styles.count}>{group.items.length}</span>
      </h3>
      <ul>
        {shown.map((finding, index) => (
          <li key={`${finding.field}-${index}`} className={styles.finding}>
            <code className={styles.findingField}>{finding.field}</code>
            <FindingValue value={finding.value} />
            {finding.evidence && <ReviewEvidence items={[finding.evidence]} />}
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button type="button" className={styles.btnLink} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Ver menos" : `Ver ${hidden} más`}
        </button>
      )}
    </section>
  );
}

export default function BrandTimeline({ state, onCancel, onRestart }) {
  const running = state.status === "streaming";
  const seconds = useElapsed(running);
  const steps = checklist(state.steps);
  const groups = groupFindings(state.findings);

  return (
    <div className={styles.timelineScreen}>
      <header className={styles.screenHead}>
        <p className={styles.eyebrow}>Extrayendo</p>
        <h1>{running ? "El agente está leyendo la marca" : "Proceso terminado"}</h1>
        <p className={styles.lead}>
          {running
            ? `Una ingesta real tarda entre 60 y 90 segundos · ${seconds}s`
            : "El stream ha terminado. Revisa los hallazgos o vuelve a empezar."}
          {state.findings.length > 0 && ` · ${state.findings.length} hallazgos`}
        </p>
        <div className={styles.dropActions}>
          {running ? (
            <button type="button" className={styles.btnGhost} onClick={onCancel}>
              Cancelar
            </button>
          ) : (
            <button type="button" className={styles.btnGhost} onClick={onRestart}>
              Empezar de nuevo
            </button>
          )}
        </div>
      </header>

      {state.errors.length > 0 && (
        <div className={styles.errorPanel}>
          <h2>El agente no pudo terminar</h2>
          {state.errors.map((message, index) => (
            <p key={index}>{message}</p>
          ))}
        </div>
      )}

      {state.status === "cancelled" && <p className={styles.notice}>Ingesta cancelada.</p>}

      <ol className={styles.steps}>
        {steps.map((step) => (
          <li key={step.id} className={styles[`step_${step.status}`]}>
            <span className={styles.stepMark} aria-hidden="true" />
            <div>
              <p className={styles.stepLabel}>{step.label}</p>
              {step.detail && <p className={styles.stepDetail}>{step.detail}</p>}
            </div>
          </li>
        ))}
      </ol>

      {groups.length > 0 && <div className={styles.findings}>{groups.map((group) => <FindingGroup key={group.group} group={group} />)}</div>}

      {state.status === "done" && !state.record && (
        <p className={styles.notice}>El stream terminó sin devolver un borrador.</p>
      )}
    </div>
  );
}
