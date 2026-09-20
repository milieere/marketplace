"use client";

import { issuesAbout } from "../../../features/brand-ingest/brandRecordView";
import styles from "../brandOnboarding.module.css";
import ReviewAttributes from "./ReviewAttributes";
import ReviewField from "./ReviewField";

const STYLE_LABELS = {
  radius: "Radio",
  density: "Densidad",
  headlineCase: "Titulares",
  imageTreatment: "Tratamiento de imagen",
  composition: "Composición",
  ornament: "Ornamento",
};

export default function BrandKitReview({ kit, index, issues, onColorChange, onKitChange }) {
  const patchVoice = (patch) => onKitChange({ voice: { ...kit.voice, ...patch } });

  return (
    <>
      <section className={styles.reviewSection}>
        <h2>Colores</h2>
        <div className={styles.fields}>
          {kit.colors.map((color, position) => (
            <ReviewField
              key={color.id}
              path={`brandKit.colors[${color.id}]`}
              label={`${color.id} · ${color.role}`}
              index={index}
              inputId={`color-${color.id}`}
              issues={issuesAbout(issues, `color ${color.id}`, `colors[${color.id}]`)}
            >
              <div className={styles.colorRow}>
                <input
                  type="color"
                  className={styles.colorPicker}
                  value={color.hex}
                  onChange={(event) => onColorChange(position, { hex: event.target.value.toUpperCase() })}
                  aria-label={`Color ${color.id}`}
                />
                <input
                  id={`color-${color.id}`}
                  className={styles.input}
                  value={color.hex}
                  onChange={(event) => onColorChange(position, { hex: event.target.value })}
                  spellCheck={false}
                />
              </div>
              <p className={styles.sub}>combina con {color.pairsWith.join(", ") || "—"}</p>
            </ReviewField>
          ))}
        </div>
      </section>

      <section className={styles.reviewSection}>
        <h2>Tipografía y logos</h2>
        <div className={styles.fields}>
          {kit.typography.map((font) => (
            <ReviewField key={font.role} path="brandKit.typography" label={font.role} index={index}>
              <span className={styles.readonly}>
                {font.family} · {font.weights.join("/")} · fallback {font.fallback}
              </span>
            </ReviewField>
          ))}
          {kit.logos.map((logo) => (
            <ReviewField
              key={logo.variant}
              path="brandKit.logos"
              label={`Logo ${logo.variant}`}
              index={index}
              issues={issuesAbout(issues, `logo ${logo.variant}`)}
            >
              <code className={styles.readonly}>{logo.url}</code>
              <p className={styles.sub}>sobre {logo.onBackgrounds.join(", ") || "—"}</p>
            </ReviewField>
          ))}
        </div>
      </section>

      <section className={styles.reviewSection}>
        <h2>Estilo</h2>
        <div className={styles.fields}>
          {Object.entries(kit.style).map(([key, value]) => (
            <ReviewField key={key} path={`brandKit.style.${key}`} label={STYLE_LABELS[key] || key} index={index}>
              <span className={styles.readonly}>{String(value)}</span>
            </ReviewField>
          ))}
        </div>
      </section>

      <section className={styles.reviewSection}>
        <h2>Tono de voz</h2>
        <div className={styles.fields}>
          <ReviewField path="brandKit.voice.summary" label="Resumen" index={index} inputId="voice-summary">
            <textarea
              id="voice-summary"
              className={styles.textarea}
              rows={2}
              value={kit.voice.summary}
              onChange={(event) => patchVoice({ summary: event.target.value })}
            />
          </ReviewField>
          <ReviewField path="brandKit.voice.doSay" label="Dice" index={index}>
            <span className={styles.readonly}>{kit.voice.doSay.join(", ")}</span>
          </ReviewField>
          <ReviewField path="brandKit.voice.dontSay" label="No dice" index={index}>
            <span className={styles.readonly}>{kit.voice.dontSay.join(", ")}</span>
          </ReviewField>
          <ReviewField path="brandKit.voice.samples" label="Ejemplos" index={index}>
            <ul className={styles.valueList}>
              {kit.voice.samples.map((sample, position) => (
                <li key={position}>{sample}</li>
              ))}
            </ul>
          </ReviewField>
          <ReviewField path="brandKit.imagery" label="Dirección de imagen" index={index}>
            <span className={styles.readonly}>{kit.imagery.style}</span>
            <p className={styles.sub}>evitar: {kit.imagery.avoid.join(", ") || "—"}</p>
          </ReviewField>
        </div>
      </section>

      <section className={styles.reviewSection}>
        <h2>Fotos ({kit.photos.length})</h2>
        <div className={styles.fields}>
          {kit.photos.map((photo) => (
            <ReviewField
              key={photo.id}
              path={`brandKit.photos[${photo.id}]`}
              label={photo.id}
              index={index}
              issues={issuesAbout(issues, `photo ${photo.id}`, `photos[${photo.id}]`)}
            >
              <span className={styles.readonly}>{photo.description}</span>
              <p className={styles.sub}>
                {photo.orientation} · {photo.url}
              </p>
              <ReviewAttributes attributes={photo.attributes} />
            </ReviewField>
          ))}
        </div>
      </section>

      <section className={styles.reviewSection}>
        <h2>Reglas ({kit.rules.length})</h2>
        <ul className={styles.rules}>
          {kit.rules.map((rule) => (
            <li key={rule.id} className={rule.severity === "block" ? styles.ruleBlock : styles.ruleWarn}>
              <span className={styles.ruleSeverity}>{rule.severity}</span>
              <span>{rule.text}</span>
              {rule.check && <code className={styles.sub}>{JSON.stringify(rule.check)}</code>}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

