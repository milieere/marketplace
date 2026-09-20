"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";
import {
  faArrowLeft,
  faBookmark,
  faCalendarDays,
  faClock,
  faGlobe,
  faHeart,
  faLocationDot,
  faMapLocationDot,
  faShareNodes,
} from "../../lib/fontawesome";
import { readAdDetailRaw } from "../../lib/adDetailStorage";
import { getApiUrl } from "../../lib/api/generate";
import styles from "./adDetailPage.module.css";

const FALLBACK_THEME = {
  brand: { id: "oli", name: "Oli", summary: "Anuncio personalizado" },
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
    style: { radius: 8, density: "balanced", headlineCase: "sentence", imageTreatment: "full-bleed", composition: "image-top", ornament: "none" },
    voice: { summary: "Clear, useful and direct." },
    imagery: { style: "Personalized ad direction" },
    logos: [],
  },
};

const UNIT_LABELS = {
  person: "pp",
  group: "total",
  night: "noche",
  item: "",
  hour: "h",
};

function assetSource(src) {
  if (!src) return null;
  if (src.startsWith("data:") || src.startsWith("http")) return src;
  if (src.startsWith("/")) return `${getApiUrl()}${src}`;
  return src;
}

function extractLogoSrc(html) {
  const src = html?.match(/<img[^>]*class="[^"]*\blogo\b[^"]*"[^>]*\ssrc="([^"]+)"/i)?.[1];
  return assetSource(src);
}

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

function brandLogo(kit, html) {
  const embeddedLogo = extractLogoSrc(html);
  if (embeddedLogo) return embeddedLogo;
  const logo = kit.logos.find((item) => item.variant === "icon") || kit.logos.find((item) => item.variant === "mono") || kit.logos[0];
  if (logo?.url?.startsWith("/assets/")) return null;
  return assetSource(logo?.url);
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

function formatPrice(line, language) {
  const amount = new Intl.NumberFormat(language || "es", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(line.amount);
  const unit = UNIT_LABELS[line.unit];
  return `${line.from ? "desde " : ""}${amount}${unit ? ` / ${unit}` : ""}`;
}

function firstPrice(lines, language) {
  return lines?.[0] ? formatPrice(lines[0], language) : null;
}

function mapsUrl(locationId) {
  if (!locationId) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationId.replace(/-/g, " "))}`;
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function shareDetail(artifact) {
  const shareData = {
    title: artifact.slots.headline,
    text: artifact.slots.subline || artifact.slots.body,
    url: window.location.href,
  };

  if (navigator.share) {
    navigator.share(shareData).catch(() => undefined);
    return;
  }

  navigator.clipboard?.writeText(window.location.href);
}

function subscribeToStorage(callback) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function useSelectedDetail(id) {
  const raw = useSyncExternalStore(subscribeToStorage, () => readAdDetailRaw(id), () => null);
  const detail = useMemo(() => {
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.artifact?.id === id || parsed?.artifact ? parsed : null;
    } catch {
      return null;
    }
  }, [id, raw]);

  return { detail, loaded: true };
}

export default function AdDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const { detail, loaded } = useSelectedDetail(id);
  const artifact = detail?.artifact;
  const presentation = artifact?.presentation || FALLBACK_THEME;
  const kit = presentation.kit;
  const logoSrc = brandLogo(kit, detail?.html);
  const fonts = fontHref(kit);
  const heroSrc = detail?.visual?.imageUrl || artifact?.presentation?.photo?.src;
  const leadPrice = artifact ? firstPrice(artifact.priceLines, artifact.language) : null;
  const mapHref = artifact ? mapsUrl(artifact.locationId) : null;

  if (!loaded) {
    return <main className={styles.loading}>Cargando anuncio...</main>;
  }

  if (!artifact) {
    return (
      <main className={styles.empty}>
        <button type="button" onClick={() => router.push("/opciones")} className={styles.backButton}>
          <FontAwesomeIcon icon={faArrowLeft} />
          Volver a opciones
        </button>
        <h1>No encontramos el anuncio seleccionado</h1>
        <p>Abre esta vista desde una de las opciones generadas para conservar el brandkit, la imagen y la oferta.</p>
      </main>
    );
  }

  return (
    <main className={styles.detail} style={cssVars(presentation)}>
      {fonts && <link rel="stylesheet" href={fonts} />}
      {kit.typography.map((font) => font.fontUrl && <link key={font.fontUrl} rel="stylesheet" href={font.fontUrl} />)}

      <section className={styles.hero}>
        <div className={styles.heroMedia}>
          {heroSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- Artifact images can be data URLs or API assets.
            <img src={assetSource(heroSrc)} alt={presentation.photo?.alt || artifact.slots.headline} />
          ) : (
            <div className={styles.heroFallback} />
          )}
        </div>
        <div className={styles.heroShade} />

        <nav className={styles.topbar} aria-label="Detalle del anuncio">
          <button type="button" onClick={() => router.back()} aria-label="Volver">
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <div>
            <button type="button" aria-label="Guardar">
              <FontAwesomeIcon icon={faHeart} />
            </button>
            <button type="button" aria-label="Compartir" onClick={() => shareDetail(artifact)}>
              <FontAwesomeIcon icon={faShareNodes} />
            </button>
          </div>
        </nav>

        <div className={styles.heroContent}>
          <div className={styles.brandLockup}>
            <div className={styles.logo}>
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- Brand logos can arrive from the API or local fixtures.
                <img src={logoSrc} alt={`${presentation.brand.name} logo`} />
              ) : (
                <span>{mark(presentation.brand.name)}</span>
              )}
            </div>
            <span>{presentation.brand.name}</span>
          </div>

          <div className={styles.titleBlock}>
            <span>{presentation.brand.name}</span>
            <h1>{artifact.slots.headline}</h1>
            {artifact.slots.subline && <p>{artifact.slots.subline}</p>}
          </div>

          <div className={styles.metaRow}>
            {leadPrice && <span>{leadPrice}</span>}
            {artifact.priceLines.slice(0, 2).map((line) => (
              <span key={line.offeringId}>{line.label}</span>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.actionPanel}>
        <a href={mapHref || "#"} target={mapHref ? "_blank" : undefined} rel="noreferrer" aria-disabled={!mapHref}>
          <FontAwesomeIcon icon={faMapLocationDot} />
          Ir al lugar
        </a>
        <button type="button" aria-label="Horarios" onClick={() => scrollToSection("detail-info")}>
          <FontAwesomeIcon icon={faClock} />
          Horarios
        </button>
        <a href={artifact.slots.cta.url} target="_blank" rel="noreferrer" className={styles.primaryAction}>
          <FontAwesomeIcon icon={faCalendarDays} />
          Reserva
        </a>
        <button type="button">
          <FontAwesomeIcon icon={faBookmark} />
          Guardar
        </button>
        <button type="button" onClick={() => shareDetail(artifact)}>
          <FontAwesomeIcon icon={faShareNodes} />
          Redes
        </button>
      </section>

      <section className={styles.contentGrid}>
        <article className={styles.about}>
          <span className={styles.kicker}>Detalle del servicio</span>
          <h2>{artifact.slots.subline || artifact.slots.headline}</h2>
          <p>{artifact.slots.body}</p>
          {artifact.slots.badges.length > 0 && (
            <ul className={styles.badges}>
              {artifact.slots.badges.map((badge) => (
                <li key={badge}>{badge}</li>
              ))}
            </ul>
          )}
        </article>

        <aside className={styles.offerCard}>
          <span className={styles.kicker}>Precio y opciones</span>
          <ul>
            {artifact.priceLines.map((line) => (
              <li key={line.offeringId}>
                <span>{line.label}</span>
                <strong>{formatPrice(line, artifact.language)}</strong>
              </li>
            ))}
          </ul>
        </aside>

        <article className={styles.signalCard} id="detail-info">
          <span className={styles.kicker}>Informacion practica</span>
          <div>
            <FontAwesomeIcon icon={faLocationDot} />
            <span>{artifact.locationId ? artifact.locationId.replace(/-/g, " ") : "Ubicacion disponible al reservar"}</span>
          </div>
          <div>
            <FontAwesomeIcon icon={faClock} />
            <span>Horarios y disponibilidad se confirman en la reserva</span>
          </div>
          <div>
            <FontAwesomeIcon icon={faGlobe} />
            <span>{presentation.brand.name}</span>
          </div>
        </article>

        <article className={styles.included}>
          <span className={styles.kicker}>Lo que encaja con tu busqueda</span>
          <ul>
            {(artifact.slots.badges.length ? artifact.slots.badges : artifact.priceLines.map((line) => line.label)).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
