"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter } from "next/navigation";
import { faArrowUpRightFromSquare, faBullseye, faTriangleExclamation } from "../../lib/fontawesome";
import { saveAdDetail } from "../../lib/adDetailStorage";
import { getApiUrl } from "../../lib/api/generate";
import styles from "./cardView.module.css";

const FALLBACK_THEME = {
  brand: { id: "oli", name: "Oli", summary: "Personalized recommendation" },
  kit: {
    colors: [
      { id: "blue", hex: "#1F98B9", role: "primary" },
      { id: "ink", hex: "#08233E", role: "secondary" },
      { id: "green", hex: "#50E07C", role: "accent" },
      { id: "white", hex: "#F4F8FF", role: "background" },
      { id: "text", hex: "#08233E", role: "text" },
    ],
    typography: [
      { role: "display", family: "Inter", fallback: "system-ui, sans-serif" },
      { role: "body", family: "Inter", fallback: "system-ui, sans-serif" },
    ],
    style: {
      radius: 8,
      density: "balanced",
      headlineCase: "sentence",
      imageTreatment: "full-bleed",
      composition: "image-side",
      ornament: "rule",
    },
    voice: { summary: "Clear, useful and direct." },
    imagery: { style: "Personalized ad direction" },
  },
};

// `subtitle` carries the raw NoMatch reason; never show the enum itself
const NO_MATCH = {
  "no-results": {
    label: "Sin coincidencias",
    icon: faBullseye,
    hint: "Las dietas, la accesibilidad y el tamaño del grupo nunca se relajan.",
  },
  "out-of-domain": {
    label: "Fuera de alcance",
    icon: faTriangleExclamation,
    hint: "Oli trabaja con restaurantes, bares y hoteles.",
  },
};

const UNIT_LABELS = {
  person: "pp",
  group: "total",
  night: "noche",
  item: "",
  hour: "h",
};

function color(kit, role, fallback) {
  return kit.colors.find((item) => item.role === role)?.hex || fallback;
}

function typeface(kit, role) {
  return kit.typography.find((item) => item.role === role) || kit.typography[0] || FALLBACK_THEME.kit.typography[0];
}

function fontFamily(font) {
  return `'${font.family}', ${font.fallback}`;
}

function fontHref(kit) {
  const families = [...new Set(kit.typography.filter((font) => !font.fontUrl).map((font) => font.family))];
  if (!families.length) return null;
  const query = families.map((family) => `family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;600;700;800;900`).join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

function mark(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function cssVars(presentation) {
  const kit = presentation.kit;
  const display = typeface(kit, "display");
  const body = typeface(kit, "body");
  return {
    "--brand-primary": color(kit, "primary", "#1F98B9"),
    "--brand-secondary": color(kit, "secondary", color(kit, "primary", "#08233E")),
    "--brand-accent": color(kit, "accent", color(kit, "primary", "#50E07C")),
    "--brand-background": color(kit, "background", "#F4F8FF"),
    "--brand-text": color(kit, "text", "#08233E"),
    "--brand-radius": `${Math.min(Math.max(kit.style.radius, 0), 22)}px`,
    "--font-display": fontFamily(display),
    "--font-body": fontFamily(body),
  };
}

function extractImageSrc(html) {
  const src = html?.match(/<img[^>]*\ssrc="([^"]+)"/i)?.[1];
  return assetSource(src);
}

function extractLogoSrc(html) {
  const src = html?.match(/<img[^>]*class="[^"]*\blogo\b[^"]*"[^>]*\ssrc="([^"]+)"/i)?.[1];
  return assetSource(src);
}

function assetSource(src) {
  if (!src) return null;
  if (src.startsWith("data:") || src.startsWith("http")) return src;
  if (src.startsWith("/")) return `${getApiUrl()}${src}`;
  return src;
}

function brandLogo(kit, html) {
  const embeddedLogo = extractLogoSrc(html);
  if (embeddedLogo) return embeddedLogo;
  const logo = kit.logos.find((item) => item.variant === "icon") || kit.logos.find((item) => item.variant === "mono") || kit.logos[0];
  if (logo?.url?.startsWith("/assets/")) return null;
  return assetSource(logo?.url);
}

function formatPrice(line, language) {
  const amount = new Intl.NumberFormat(language || "es", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(line.amount);
  const unit = UNIT_LABELS[line.unit];
  return `${line.from ? "desde " : ""}${amount}${unit ? ` / ${unit}` : ""}`;
}

function generateFromSuggestion(router, suggestion) {
  const text = suggestion.patch?.change?.text || suggestion.label;
  router.push(`/opciones?query=${encodeURIComponent(text)}`);
}

function openDetail(router, artifact, html, visual) {
  saveAdDetail({ artifact, html, visual });
  router.push(`/detalle/${artifact.id}`);
}

function imageSource(artifact, html, visual) {
  return visual?.imageUrl || artifact.presentation?.photo?.src || extractImageSrc(html);
}

function AssemblyOverlay({ visual, visualStatus, isGenerating, presentation, logoSrc }) {
  const failed = visualStatus === "failed";
  const done = Boolean(visual);
  const label = done
    ? "Visual listo"
    : failed
      ? "Componiendo fallback de marca"
      : isGenerating
        ? "Ensamblando anuncio"
        : "Visual de marca";

  if (done || (failed && !isGenerating)) return null;
  const kit = presentation.kit;
  const stages = [
    ["Brand kit", "done"],
    ["Layout", "done"],
    ["Copy", "done"],
    [failed ? "Fallback" : "Imagen", failed ? "failed" : "started"],
  ];

  return (
    <div className={styles.assembly} data-status={failed ? "failed" : "building"}>
      <div className={styles.assemblyPreview}>
        <span className={styles.assemblyScan} />
        <div className={styles.assemblyLogo}>
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- Brand logos can arrive from the API or local fixtures.
            <img src={logoSrc} alt={`${presentation.brand.name} logo`} />
          ) : (
            <span>{mark(presentation.brand.name)}</span>
          )}
        </div>
        <div className={styles.assemblyPalette} aria-hidden="true">
          {kit.colors.slice(0, 4).map((item) => (
            <span key={item.id} style={{ background: item.hex }} />
          ))}
        </div>
      </div>
      <div className={styles.assemblyInfo}>
        <div className={styles.assemblyTopline}>
          <span>{presentation.brand.name}</span>
          <span>{label}</span>
        </div>
        <div className={styles.assemblyBlueprint} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className={styles.assemblySteps}>
          {stages.map(([item, status]) => (
            <span key={item} data-status={status}>
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CardView({ title, subtitle, artifact, html, visual, visualStatus, isGenerating = false, suggestions = [] }) {
  const router = useRouter();

  if (!artifact) {
    const reason = NO_MATCH[subtitle];
    return (
      <article className={`${styles.cardView} ${styles.emptyState}`} style={cssVars(FALLBACK_THEME)}>
        <div className={styles.emptyPanel}>
          <span className={styles.emptyGlow} aria-hidden="true" />
          <span className={styles.emptyBadge} aria-hidden="true">
            <FontAwesomeIcon icon={reason?.icon || faBullseye} />
          </span>
          <span className={styles.kicker}>{reason?.label || "Oli"}</span>
          <h2>{title}</h2>
          <p>{reason?.hint || "Cuando el agente termine, el anuncio generado aparecerá aquí."}</p>
          {suggestions.length > 0 && (
            <div className={styles.suggestions}>
              {suggestions.map((suggestion) => (
                <button key={suggestion.label} type="button" onClick={() => generateFromSuggestion(router, suggestion)}>
                  {suggestion.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </article>
    );
  }

  const presentation = artifact.presentation || FALLBACK_THEME;
  const kit = presentation.kit;
  const style = kit.style;
  const imageSrc = imageSource(artifact, html, visual);
  const logoSrc = brandLogo(kit, html);
  const statusLabel = artifact.check?.passed ? "Brand check passed" : "Needs review";
  const relaxed = artifact.relaxed || [];
  const fonts = fontHref(kit);
  // The designed card is the brand's own stylesheet over the generated scene;
  // it replaces this component's generic chrome entirely.
  const designed = visual?.html;

  if (designed) {
    return (
      <article
        className={`${styles.cardView} ${styles.designed}`}
        style={cssVars(presentation)}
        role="button"
        tabIndex={0}
        aria-label={`Ver detalle de ${artifact.slots.headline || presentation.brand.name}`}
        onClick={() => openDetail(router, artifact, html, visual)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openDetail(router, artifact, html, visual);
          }
        }}
      >
        <iframe className={styles.designedFrame} title={title} srcDoc={designed} sandbox="allow-popups allow-same-origin" scrolling="no" />
      </article>
    );
  }

  return (
    <article className={styles.cardView} style={cssVars(presentation)}>
      {fonts && <link rel="stylesheet" href={fonts} />}
      {kit.typography.map((font) => font.fontUrl && <link key={font.fontUrl} rel="stylesheet" href={font.fontUrl} />)}

      <section
        className={styles.generatedAd}
        data-composition={style.composition}
        data-treatment={style.imageTreatment}
        data-density={style.density}
        data-case={style.headlineCase}
        data-ornament={style.ornament}
        data-building={!visual && isGenerating ? "true" : "false"}
        role="button"
        tabIndex={0}
        aria-label={`Ver detalle de ${artifact.slots.headline || presentation.brand.name}`}
        onClick={() => openDetail(router, artifact, html, visual)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openDetail(router, artifact, html, visual);
          }
        }}
      >
        <div className={styles.visual}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Artifact photos can arrive as data URLs from the API. */}
          {imageSrc ? <img src={imageSrc} alt={presentation.photo?.alt || ""} /> : <div className={styles.generatedBackdrop} />}
          {!visual && (
            <div className={styles.visualStatus}>
              <span />
              {visualStatus === "failed" ? "Brand fallback active" : "Generating brand visual"}
            </div>
          )}
          <div className={styles.visualOverlay}>
            <span>{kit.imagery.style}</span>
            <strong>{presentation.brand.name}</strong>
          </div>
          <div className={styles.brandMark}>
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- Brand logos can arrive from the API or local fixtures.
              <img src={logoSrc} alt={`${presentation.brand.name} logo`} />
            ) : (
              mark(presentation.brand.name)
            )}
          </div>
        </div>

        <div className={styles.copy}>
          <div className={styles.topline}>
            <span className={styles.toplineBrand}>
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- Brand logos can arrive embedded in the artifact HTML.
                <img src={logoSrc} alt="" />
              ) : null}
              {presentation.brand.name}
            </span>
            <span data-status={artifact.check?.passed ? "passed" : "review"}>{statusLabel}</span>
          </div>

          <h2>{artifact.slots.headline || title}</h2>
          {artifact.slots.subline && <p className={styles.subline}>{artifact.slots.subline}</p>}
          <p className={styles.body}>{artifact.slots.body}</p>

          {artifact.slots.badges.length > 0 && (
            <ul className={styles.badges} aria-label="Motivos por los que encaja">
              {artifact.slots.badges.map((badge) => (
                <li key={badge}>{badge}</li>
              ))}
            </ul>
          )}

          <div className={styles.offerBox}>
            <span>Oferta recomendada</span>
            <ul>
              {artifact.priceLines.map((line) => (
                <li key={line.offeringId}>
                  <strong>{line.label}</strong>
                  <span>{formatPrice(line, artifact.language)}</span>
                </li>
              ))}
            </ul>
          </div>

          {relaxed.length > 0 && (
            <div className={styles.relaxed}>
              <strong>Ajuste honesto</strong>
              <span>{relaxed.map((item) => item.constraint.replace(/:/g, " ")).join(", ")}</span>
            </div>
          )}

          <a className={styles.cta} href={artifact.slots.cta.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
            {artifact.slots.cta.label}
          </a>
          <button
            type="button"
            className={styles.detailCta}
            onClick={(event) => {
              event.stopPropagation();
              openDetail(router, artifact, html, visual);
            }}
          >
            Ver detalle
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
          </button>
        </div>
        <AssemblyOverlay visual={visual} visualStatus={visualStatus} isGenerating={isGenerating} presentation={presentation} logoSrc={logoSrc} />
      </section>

      {html && (
        <details className={styles.htmlPreview}>
          <summary>Ver artifact HTML</summary>
          <iframe title={`${title} HTML`} srcDoc={html} sandbox="allow-popups" />
        </details>
      )}
    </article>
  );
}
