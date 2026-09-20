"use client";

import { issuesAbout } from "../../../features/brand-ingest/brandRecordView";
import styles from "../brandOnboarding.module.css";
import ReviewAttributes from "./ReviewAttributes";
import ReviewField from "./ReviewField";

const WEEKDAYS = { mon: "lun", tue: "mar", wed: "mié", thu: "jue", fri: "vie", sat: "sáb", sun: "dom" };

function hoursText(openingHours) {
  const days = Object.entries(openingHours || {}).filter(([, ranges]) => ranges?.length);
  if (!days.length) return "sin horario";
  return days.map(([day, ranges]) => `${WEEKDAYS[day] || day} ${ranges.map((r) => `${r.from}–${r.to}`).join(", ")}`).join(" · ");
}

function availabilityText(offering) {
  const parts = [];
  const days = offering.availability?.days;
  if (days?.length) parts.push(days.map((day) => WEEKDAYS[day] || day).join(", "));
  if (offering.availability?.from) parts.push(`desde ${offering.availability.from}`);
  if (offering.availability?.to) parts.push(`hasta ${offering.availability.to}`);
  if (offering.availability?.validUntil) parts.push(`válido hasta ${offering.availability.validUntil}`);
  if (offering.partySize?.min) parts.push(`mín. ${offering.partySize.min}`);
  if (offering.partySize?.max) parts.push(`máx. ${offering.partySize.max}`);
  return parts.join(" · ") || "sin restricciones";
}

export default function BrandOffersReview({ record, index, issues, onLocationChange, onOfferingChange }) {
  return (
    <>
      <section className={styles.reviewSection}>
        <h2>Ubicaciones ({record.locations.length})</h2>
        <div className={styles.fields}>
          {record.locations.map((location, position) => (
            <ReviewField
              key={location.id}
              path={`locations[${location.id}]`}
              label={location.id}
              index={index}
              inputId={`location-${location.id}`}
              issues={issuesAbout(issues, `location ${location.id}`, `locations[${location.id}]`)}
            >
              <input
                id={`location-${location.id}`}
                className={styles.input}
                value={location.name}
                onChange={(event) => onLocationChange(position, { name: event.target.value })}
              />
              <input
                className={styles.input}
                value={location.address}
                onChange={(event) => onLocationChange(position, { address: event.target.value })}
                aria-label={`Dirección de ${location.name}`}
              />
              <p className={styles.sub}>
                {location.timezone} · {hoursText(location.openingHours)}
                {location.priceLevel ? ` · ${"€".repeat(location.priceLevel)}` : ""}
              </p>
              <ReviewAttributes attributes={location.attributes} />
            </ReviewField>
          ))}
        </div>
      </section>

      <section className={styles.reviewSection}>
        <h2>Ofertas ({record.offerings.length})</h2>
        <div className={styles.fields}>
          {record.offerings.map((offering, position) => (
            <ReviewField
              key={offering.id}
              path={`offerings[${offering.id}]`}
              label={`${offering.id} · ${offering.kind}`}
              index={index}
              inputId={`offering-${offering.id}`}
              issues={issuesAbout(issues, `offering ${offering.id}`, `offerings[${offering.id}]`)}
            >
              <input
                id={`offering-${offering.id}`}
                className={styles.input}
                value={offering.name}
                onChange={(event) => onOfferingChange(position, { name: event.target.value })}
              />
              <textarea
                className={styles.textarea}
                rows={2}
                value={offering.description}
                onChange={(event) => onOfferingChange(position, { description: event.target.value })}
                aria-label={`Descripción de ${offering.name}`}
              />
              <div className={styles.priceRow}>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className={styles.inputNarrow}
                  value={offering.price.amount}
                  onChange={(event) =>
                    onOfferingChange(position, { price: { ...offering.price, amount: Number(event.target.value) } })
                  }
                  aria-label={`Precio de ${offering.name}`}
                />
                <span className={styles.readonly}>
                  {offering.price.currency} / {offering.price.unit}
                  {offering.price.from ? " · desde" : ""}
                </span>
              </div>
              <input
                className={styles.input}
                value={offering.conditions || ""}
                placeholder="Condiciones"
                onChange={(event) => onOfferingChange(position, { conditions: event.target.value || undefined })}
                aria-label={`Condiciones de ${offering.name}`}
              />
              <p className={styles.sub}>{availabilityText(offering)}</p>
              <ReviewAttributes attributes={offering.attributes} />
            </ReviewField>
          ))}
        </div>
      </section>

      <section className={styles.reviewSection}>
        <h2>Documentos ({record.documents.length})</h2>
        <ul className={styles.documents}>
          {record.documents.map((document) => (
            <li key={document.id}>
              <span className={styles.tagKey}>{document.kind}</span>
              <code>{document.id}</code>
              <span className={styles.sub}>{document.uri}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
