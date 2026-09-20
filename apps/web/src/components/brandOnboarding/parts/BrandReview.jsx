"use client";

import { useMemo, useState } from "react";
import { indexEvidence, lowConfidence, replaceAt } from "../../../features/brand-ingest/brandRecordView";
import { verifyBrand } from "../../../lib/api/brands";
import styles from "../brandOnboarding.module.css";
import BrandKitReview from "./BrandKitReview";
import BrandOffersReview from "./BrandOffersReview";
import ReviewField from "./ReviewField";

export default function BrandReview({ record: draft, onRestart }) {
  const [record, setRecord] = useState(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [issues, setIssues] = useState([]);
  const [saved, setSaved] = useState(null);

  const index = useMemo(() => indexEvidence(record.evidence), [record.evidence]);
  const weak = useMemo(() => lowConfidence(record.evidence), [record.evidence]);

  const patchBrand = (patch) => setRecord((current) => ({ ...current, brand: { ...current.brand, ...patch } }));
  const patchKit = (patch) => setRecord((current) => ({ ...current, brandKit: { ...current.brandKit, ...patch } }));
  const patchColor = (position, patch) =>
    setRecord((current) => ({
      ...current,
      brandKit: {
        ...current.brandKit,
        colors: replaceAt(current.brandKit.colors, position, { ...current.brandKit.colors[position], ...patch }),
      },
    }));
  const patchLocation = (position, patch) =>
    setRecord((current) => ({
      ...current,
      locations: replaceAt(current.locations, position, { ...current.locations[position], ...patch }),
    }));
  const patchOffering = (position, patch) =>
    setRecord((current) => ({
      ...current,
      offerings: replaceAt(current.offerings, position, { ...current.offerings[position], ...patch }),
    }));

  async function approve() {
    setSaving(true);
    setError(null);
    setIssues([]);
    try {
      // status stays as the agent left it; the API is what promotes the record to verified
      setSaved(await verifyBrand(record));
    } catch (failure) {
      setError(failure.message);
      setIssues(failure.payload?.issues || []);
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className={styles.reviewScreen}>
        <div className={styles.successPanel}>
          <h1>{record.brand.name} está verificada</h1>
          <p>
            {saved.id} · {saved.status} · {saved.offerings} ofertas. Ya entra en el matching, sin reiniciar la API.
          </p>
          <div className={styles.dropActions}>
            <a className={styles.btnPrimary} href="/opciones">
              Ver el generador
            </a>
            <button type="button" className={styles.btnGhost} onClick={onRestart}>
              Subir otra marca
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.reviewScreen}>
      <header className={styles.reviewBar}>
        <div>
          <p className={styles.eyebrow}>Borrador · {record.status}</p>
          <h1>{record.brand.name}</h1>
          <p className={styles.lead}>
            {record.brandKit.colors.length} colores · {record.offerings.length} ofertas · {record.locations.length}{" "}
            ubicaciones · {record.evidence.length} evidencias
          </p>
        </div>
        <div className={styles.dropActions}>
          <button type="button" className={styles.btnGhost} onClick={onRestart}>
            Descartar
          </button>
          <button type="button" className={styles.btnPrimary} onClick={approve} disabled={saving}>
            {saving ? "Verificando…" : "Aprobar marca"}
          </button>
        </div>
      </header>

      {(record.reviewNotes.length > 0 || weak.length > 0) && (
        <section className={styles.notesPanel}>
          <h2>El agente pide confirmación</h2>
          <ul>
            {record.reviewNotes.map((note, position) => (
              <li key={position}>{note}</li>
            ))}
            {weak.map((item, position) => (
              <li key={`weak-${position}`}>
                <code>{item.field}</code> se extrajo con {Math.round(item.confidence * 100)}% de confianza
                {item.quote ? ` — “${item.quote}”` : ""}.
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <section className={styles.errorPanel}>
          <h2>No se pudo verificar</h2>
          <p>{error}</p>
          {issues.length > 0 && (
            <ul>
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className={styles.reviewSection}>
        <h2>Identidad</h2>
        <div className={styles.fields}>
          <ReviewField path="brand.name" label="Nombre" index={index} inputId="review-brand-name">
            <input
              id="review-brand-name"
              className={styles.input}
              value={record.brand.name}
              onChange={(event) => patchBrand({ name: event.target.value })}
            />
          </ReviewField>
          <ReviewField path="brand.summary" label="Resumen" index={index} inputId="review-brand-summary">
            <textarea
              id="review-brand-summary"
              className={styles.textarea}
              rows={3}
              value={record.brand.summary}
              onChange={(event) => patchBrand({ summary: event.target.value })}
            />
          </ReviewField>
          <ReviewField path="brand.website" label="Web" index={index} inputId="review-brand-website">
            <input
              id="review-brand-website"
              className={styles.input}
              value={record.brand.website || ""}
              onChange={(event) => patchBrand({ website: event.target.value || undefined })}
            />
          </ReviewField>
          <ReviewField path="brand.industry" label="Sector" index={index}>
            <span className={styles.readonly}>{record.brand.industry}</span>
          </ReviewField>
          <ReviewField path="brand.languages" label="Idiomas" index={index}>
            <span className={styles.readonly}>{record.brand.languages.join(", ")}</span>
          </ReviewField>
          <ReviewField path="brand.id" label="Identificador" index={index}>
            <code className={styles.readonly}>{record.brand.id}</code>
          </ReviewField>
        </div>
      </section>

      <BrandKitReview
        kit={record.brandKit}
        index={index}
        issues={issues}
        onColorChange={patchColor}
        onKitChange={patchKit}
      />

      <BrandOffersReview
        record={record}
        index={index}
        issues={issues}
        onLocationChange={patchLocation}
        onOfferingChange={patchOffering}
      />

      <div className={styles.reviewFooter}>
        <button type="button" className={styles.btnPrimary} onClick={approve} disabled={saving}>
          {saving ? "Verificando…" : "Aprobar marca"}
        </button>
      </div>
    </div>
  );
}
