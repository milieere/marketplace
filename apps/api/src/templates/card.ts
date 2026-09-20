import type { Artifact } from "@marketplace/contracts/artifact";
import type { BrandKit, BrandRecord, Location, Photo, PriceUnit } from "@marketplace/contracts/brand-record";
import { contrast, palette, type Palette } from "../domain/color";

export type CardInput = {
  record: BrandRecord;
  language: string;
  slots: Artifact["slots"];
  priceLines: Artifact["priceLines"];
  currency: string;
  photo?: { src: string; alt: string };
  logo?: { src: string };
  location?: Location;
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function typeface(kit: BrandKit, role: "display" | "body"): BrandKit["typography"][number] {
  return kit.typography.find((x) => x.role === role) ?? kit.typography.find((x) => x.role === "heading") ?? kit.typography[0]!;
}

// Brand-declared weights only; avoids faux-bold display faces
export function fontLink(kit: BrandKit): string {
  const weights = new Map<string, Set<number>>();
  for (const t of kit.typography) {
    const set = weights.get(t.family) ?? new Set<number>();
    for (const w of t.weights) set.add(w);
    weights.set(t.family, set);
  }
  const query = [...weights]
    .map(([family, set]) => `family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@${[...set].sort((a, b) => a - b).join(";")}`)
    .join("&");
  return `<link href="https://fonts.googleapis.com/css2?${query}&display=swap" rel="stylesheet">`;
}

export function font(kit: BrandKit, role: "display" | "body"): string {
  const t = typeface(kit, role);
  return `'${t.family}',${t.fallback}`;
}

function weight(kit: BrandKit, role: "display" | "body", end: "min" | "max"): number {
  const sorted = [...typeface(kit, role).weights].sort((a, b) => a - b);
  return end === "max" ? sorted.at(-1)! : sorted[0]!;
}

const UNIT: Record<PriceUnit, string> = { person: " pp", group: "", night: " / night", item: "", hour: " / h" };
const FROM: Record<string, string> = { en: "from", es: "desde", ca: "des de", fr: "dès" };

export function formatPrice(line: Artifact["priceLines"][number], currency: string, language: string): string {
  const amount = new Intl.NumberFormat(language, { style: "currency", currency, maximumFractionDigits: 0 }).format(line.amount);
  return `${line.from ? `${FROM[language] ?? FROM.en} ` : ""}${amount}${UNIT[line.unit]}`;
}

const PIN = `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>`;

export function currencySymbol(currency: string, language: string): string {
  const parts = new Intl.NumberFormat(language, { style: "currency", currency, maximumFractionDigits: 0 }).formatToParts(0);
  return parts.find((part) => part.type === "currency")?.value ?? "";
}

// Place and price level come from Location data, never from copy
function metaRow(input: CardInput): string {
  const { location, currency, language } = input;
  if (!location) return "";
  const level = location.priceLevel ? `<span class="level">${escapeHtml(currencySymbol(currency, language).repeat(location.priceLevel))}</span>` : "";
  return `<div class="meta"><span class="place">${PIN}${escapeHtml(location.name)}</span>${level}</div>`;
}

export const CASE = { upper: "uppercase", title: "capitalize", sentence: "none" } as const;
export const HEAD_TRACKING = { upper: ".01em", title: "0", sentence: "-.01em" } as const;
export const MARK_TRACKING = { upper: ".2em", title: ".1em", sentence: ".14em" } as const;
export const PADDING = { airy: 30, balanced: 24, dense: 18 } as const;
export const LAYOUT = { "text-over-image": "poster", "image-top": "editorial", "image-side": "split" } as const;
export const HEADLINE = {
  poster: { airy: 38, balanced: 36, dense: 42 },
  editorial: { airy: 31, balanced: 30, dense: 34 },
  split: { airy: 27, balanced: 26, dense: 30 },
} as const;
export const MEDIA_HEIGHT = { airy: 240, balanced: 215, dense: 190 } as const;
const ORIENTATION = { poster: "portrait", editorial: "landscape", split: "portrait" } as const;
export const CARD_WIDTH = { poster: 430, editorial: 430, split: 680 } as const;
// The card's own proportions. Not ORIENTATION, which is the shape of the photo to pick:
// an editorial card is portrait even though its media band is landscape.
export const ASPECT = { poster: "3:4", editorial: "4:5", split: "3:2" } as const;

// The HTML applies text-transform in CSS, so slots.headline is not the visible string.
export function applyCase(text: string, headlineCase: BrandKit["style"]["headlineCase"]): string {
  if (headlineCase === "upper") return text.toLocaleUpperCase();
  if (headlineCase === "title") return text.replace(/\p{L}[\p{L}\p{M}'']*/gu, (w) => w[0]!.toLocaleUpperCase() + w.slice(1));
  return text;
}

// priceLines carry no currency of their own; it lives on the offering they came from.
export function cardCurrency(record: BrandRecord, priceLines: Artifact["priceLines"]): string {
  return record.offerings.find((o) => o.id === priceLines[0]?.offeringId)?.price.currency ?? "EUR";
}

export function preferredOrientation(kit: BrandKit): Photo["orientation"] {
  return ORIENTATION[LAYOUT[kit.style.composition]];
}

export type Surface = { bg: string; fg: string };
type LayoutArgs = { kit: BrandKit; surface: Surface; pad: number; radius: number; framed: boolean };

// Variant declared safe on the surface the lockup lands on
export function pickLogo(kit: BrandKit): BrandKit["logos"][number] | undefined {
  if (!kit.logos.length) return undefined;
  const p = palette(kit);
  const surface = LAYOUT[kit.style.composition] === "poster" ? p.deep : p.background;
  const id = kit.colors.find((c) => c.hex === surface)?.id;
  return kit.logos.find((l) => id !== undefined && l.onBackgrounds.includes(id)) ?? kit.logos[0];
}

// Wordmark from the brand's own display face; never generated
function lockup(record: BrandRecord, logo: CardInput["logo"]): string {
  if (logo) return `<div class="lockup"><img class="logo" src="${escapeHtml(logo.src)}" alt="${escapeHtml(record.brand.name)}"></div>`;
  const { ornament } = record.brandKit.style;
  const mono = ornament === "stamp" ? `<span class="mono">${escapeHtml(record.brand.name.slice(0, 1))}</span>` : "";
  const under = ornament === "rule" || ornament === "pattern" ? `<span class="underline"></span>` : "";
  return `<div class="lockup">${mono}<span class="wordmark">${escapeHtml(record.brand.name)}${under}</span></div>`;
}

function media(kit: BrandKit, p: Palette, photo: CardInput["photo"], veil: string): string {
  const { imageTreatment, ornament } = kit.style;
  const fill = photo
    ? `<img class="photo" src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.alt)}">`
    : `<div class="photo placeholder"></div>`;
  const duotone = imageTreatment === "duotone" ? `<div class="screen"></div>` : "";
  const texture = ornament === "pattern" ? `<div class="texture"></div>` : "";
  const seal = ornament === "stamp" ? `<div class="seal">${escapeHtml(kit.voice.doSay[0] ?? "")}</div>` : "";
  return `<div class="media">${fill}${duotone}${texture}<div class="veil" style="background:${veil}"></div>${seal}</div>`;
}

function body(record: BrandRecord, input: CardInput, withLockup: boolean): string {
  const { slots, priceLines, currency, language } = input;
  return [
    withLockup ? lockup(record, input.logo) : "",
    `<h1>${escapeHtml(slots.headline)}</h1>`,
    slots.subline ? `<div class="sub">${escapeHtml(slots.subline)}</div>` : "",
    `<p>${escapeHtml(slots.body)}</p>`,
    slots.badges.length ? `<div class="badges">${slots.badges.map((b) => `<span class="badge">${escapeHtml(b)}</span>`).join("")}</div>` : "",
    metaRow(input),
    `<ul class="prices">${priceLines
      .map((l) => `<li><span>${escapeHtml(l.label)}</span><strong>${escapeHtml(formatPrice(l, currency, language))}</strong></li>`)
      .join("")}</ul>`,
    `<a class="cta" href="${escapeHtml(slots.cta.url)}" target="_blank" rel="noopener">${escapeHtml(slots.cta.label)}</a>`,
  ].join("");
}

export type CardLayout = (typeof LAYOUT)[keyof typeof LAYOUT];
export type CardDesign = {
  palette: Palette;
  layout: CardLayout;
  pad: number;
  radius: number;
  framed: boolean;
  headSize: number;
  upper: boolean;
  surface: Surface;
  veil: string;
  cta: { background: string; text: string };
  onSurfaceAccent: string;
  levelColor: string;
  badgeRadius: number;
  badgeStyle: "solid" | "outline";
  badgePair: [string, string];
};

// Every contrast-dependent decision lives here so the HTML card and the image
// prompt cannot drift apart.
export function cardDesign(kit: BrandKit): CardDesign {
  const style = kit.style;
  const p = palette(kit);
  const layout = LAYOUT[style.composition];
  const radius = style.radius;
  const upper = style.headlineCase === "upper";

  // Poster copy sits on the scrim, other layouts on the brand background
  const surface: Surface = layout === "poster" ? { bg: p.deep, fg: p.onDeep } : { bg: p.background, fg: p.text };
  const veil =
    layout === "poster"
      ? `linear-gradient(to top,${p.deep} 1%,${p.deep}F0 22%,${p.deep}B8 38%,${p.primary}4D 58%,${p.deep}00 80%),linear-gradient(to bottom,${p.deep}A6,${p.deep}00 24%)`
      : `linear-gradient(to bottom,${p.deep}A6,${p.deep}00 45%),linear-gradient(to top,${p.primary}40,${p.deep}00 40%)`;

  // A CTA the colour of the scrim it sits on disappears
  const ctaOnSurface = layout === "poster" && contrast(p.cta.background, surface.bg) < 1.6;

  return {
    palette: p,
    layout,
    pad: PADDING[style.density],
    radius,
    framed: style.imageTreatment === "framed",
    headSize: HEADLINE[layout][style.density],
    upper,
    surface,
    veil,
    cta: ctaOnSurface ? { background: p.accent, text: p.onAccent } : p.cta,
    // An accent the brand pairs with another surface goes unreadable on this one
    onSurfaceAccent: contrast(p.accent, surface.bg) >= 3 ? p.accent : p.primary,
    levelColor: contrast(p.accent, surface.bg) >= 4.5 ? p.accent : surface.fg,
    badgeRadius: radius >= 16 ? 999 : Math.min(radius, 6),
    badgeStyle: upper ? "solid" : "outline",
    badgePair: upper ? [p.onAccent, p.accent] : [surface.fg, surface.bg],
  };
}

// The shared artifact page for full-card mode: the generated image is the card, but
// the CTA has to stay a real link — it cannot live inside a bitmap.
export function renderImagePage(input: { record: BrandRecord; language: string; imageUrl: string; slots: Artifact["slots"]; alt: string; logo?: string }): string {
  const { record, language, imageUrl, slots, alt, logo } = input;
  const kit = record.brandKit;
  const d = cardDesign(kit);
  const p = d.palette;
  const onArt = d.layout === "poster" ? p.onDeep : p.text;
  return `<!doctype html><html lang="${escapeHtml(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(record.brand.name)}</title><style>
*{box-sizing:border-box}
body{margin:0;padding:24px;background:${p.background};font-family:${font(record.brandKit, "body")};display:flex;justify-content:center}
.card{width:100%;max-width:${CARD_WIDTH[d.layout]}px}
.art{position:relative}
.art img{display:block;width:100%;border-radius:${record.brandKit.style.radius}px}
.lockup{position:absolute;top:5%;left:6%;right:6%;display:flex;align-items:center;gap:12px;color:${onArt}}
.lockup img{width:auto;height:2.4em;border-radius:0}
.lockup span{font:${weight(kit, "display", "max")} 1.3em/1 ${font(kit, "display")};text-transform:uppercase;letter-spacing:${MARK_TRACKING[kit.style.headlineCase]}}
.cta{display:block;margin-top:14px;text-align:center;background:${d.cta.background};color:${d.cta.text};text-decoration:none;padding:13px;border-radius:${Math.min(record.brandKit.style.radius, 14)}px;font-weight:${weight(record.brandKit, "body", "max")}}
</style></head><body><div class="card"><div class="art"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(alt)}"><div class="lockup">${logo ? `<img src="${escapeHtml(logo)}" alt="">` : ""}<span>${escapeHtml(record.brand.name)}</span></div></div><a class="cta" href="${escapeHtml(slots.cta.url)}" target="_blank" rel="noopener">${escapeHtml(slots.cta.label)}</a></div></body></html>`;
}

export function renderCard(input: CardInput): { html: string; colorPairs: [string, string][] } {
  const { record, language, photo } = input;
  const kit = record.brandKit;
  const style = kit.style;
  const d = cardDesign(kit);
  const { palette: p, layout, pad, radius, framed, headSize, upper, surface, veil, cta, onSurfaceAccent, levelColor, badgeRadius, badgePair } = d;

  const badge =
    d.badgeStyle === "solid"
      ? `background:${p.accent};color:${p.onAccent};text-transform:uppercase;letter-spacing:.08em;font-size:11px`
      : `border:1px solid ${surface.fg}59;color:${surface.fg};font-size:12px`;

  const css = `
*{box-sizing:border-box}
body{margin:0;font-family:${font(kit, "body")};font-weight:${weight(kit, "body", "min")};background:${p.background};color:${p.text};-webkit-font-smoothing:antialiased}
.card{position:relative;max-width:${CARD_WIDTH[layout]}px;margin:0 auto;border-radius:${radius}px;overflow:hidden;background:${p.background}}
.media{position:relative;overflow:hidden;isolation:isolate;background:${style.imageTreatment === "duotone" ? p.accent : p.deep}}
.photo{display:block;width:100%;height:100%;object-fit:cover;${style.imageTreatment === "duotone" ? `filter:grayscale(1) contrast(1.2);mix-blend-mode:multiply` : ""}}
.placeholder{background:linear-gradient(145deg,${p.primary},${p.accent})}
.screen{position:absolute;inset:0;background:${p.primary};mix-blend-mode:screen;opacity:.5}
.texture{position:absolute;inset:0 0 auto;height:42%;background:repeating-linear-gradient(45deg,${p.accent}33 0 10px,transparent 10px 20px)}
.veil{position:absolute;inset:0;pointer-events:none}
.seal{position:absolute;top:14px;right:14px;width:74px;height:74px;border-radius:50%;border:2px solid ${p.onAccent};background:${p.accent};color:${p.onAccent};display:flex;align-items:center;justify-content:center;text-align:center;padding:8px;transform:rotate(-9deg);font:${weight(kit, "display", "max")} 11px/1.1 ${font(kit, "display")};text-transform:uppercase;letter-spacing:.08em}
.lockup{display:flex;align-items:center;gap:10px;margin-bottom:${Math.round(pad * 0.7)}px}
.logo{height:34px;width:auto;display:block}
.mono{flex:none;width:34px;height:34px;border-radius:${radius >= 16 ? "50%" : `${Math.min(radius, 6)}px`};background:${p.accent};color:${p.onAccent};display:flex;align-items:center;justify-content:center;font:${weight(kit, "display", "max")} 19px ${font(kit, "display")}}
.wordmark{position:relative;font:${weight(kit, "display", "max")} 16px ${font(kit, "display")};text-transform:uppercase;letter-spacing:${MARK_TRACKING[style.headlineCase]};line-height:1.2}
.underline{position:absolute;left:0;right:0;bottom:-7px;height:3px;background:${style.ornament === "pattern" ? `repeating-linear-gradient(90deg,${onSurfaceAccent} 0 6px,transparent 6px 10px)` : onSurfaceAccent}}
h1{margin:0;text-wrap:balance;font-family:${font(kit, "display")};font-weight:${weight(kit, "display", "max")};font-size:${headSize}px;line-height:${upper ? 1 : 1.12};letter-spacing:${HEAD_TRACKING[style.headlineCase]};text-transform:${CASE[style.headlineCase]}}
.sub{margin-top:8px;text-wrap:balance;font-weight:${weight(kit, "body", "max")};font-size:15px;opacity:.95}
p{margin:10px 0 0;font-size:14px;line-height:1.5;opacity:.85}
.badges{display:flex;flex-wrap:wrap;gap:6px;margin-top:${Math.round(pad * 0.6)}px}
.badge{display:inline-block;border-radius:${badgeRadius}px;padding:4px 11px;font-weight:${weight(kit, "body", "max")};${badge}}
.meta{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:${Math.round(pad * 0.6)}px;font-size:13px;font-weight:${weight(kit, "body", "max")};opacity:.9}
.meta .place{display:flex;align-items:center;gap:5px}
.meta .level{font-family:${font(kit, "display")};font-weight:${weight(kit, "display", "max")};font-size:15px;color:${levelColor};letter-spacing:.06em}
.prices{list-style:none;padding:0;margin:${Math.round(pad * 0.7)}px 0 0}
.prices li{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:7px 0;border-top:1px solid ${surface.fg}26;font-size:14px}
.prices strong{font-family:${font(kit, "display")};font-weight:${weight(kit, "display", "max")};font-size:17px;white-space:nowrap}
.cta{display:block;margin-top:${Math.round(pad * 0.8)}px;text-align:center;background:${cta.background};color:${cta.text};text-decoration:none;padding:13px;border-radius:${Math.min(radius, 14)}px;font-weight:${weight(kit, "body", "max")};${upper ? "text-transform:uppercase;letter-spacing:.1em;font-size:13px" : "font-size:15px"}}
${style.ornament === "rule" ? `h1:after{content:"";display:block;width:${Math.round(headSize * 1.6)}px;height:4px;background:${onSurfaceAccent};margin-top:14px}` : ""}
${LAYOUT_CSS[layout]({ kit, surface, pad, radius, framed })}`;

  const poster = layout === "poster";
  const inner = `${media(kit, p, photo, veil)}${poster ? `<div class="topbar">${lockup(record, input.logo)}</div>` : ""}<div class="content">${body(record, input, !poster)}</div>`;

  const html = `<!doctype html><html lang="${escapeHtml(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${fontLink(kit)}<style>${css}</style></head><body><div class="card ${layout}">${inner}</div></body></html>`;

  return { html, colorPairs: [[surface.fg, surface.bg], [cta.text, cta.background], badgePair] };
}

function posterCss({ surface, pad }: LayoutArgs): string {
  return `
.card{aspect-ratio:3/4;min-height:560px;display:flex;flex-direction:column;justify-content:flex-end;color:${surface.fg}}
.media{position:absolute;inset:0}
.media .photo{height:100%}
.content{position:relative;padding:${pad}px;padding-top:${pad * 2}px}
.topbar{position:absolute;top:${pad}px;left:${pad}px;right:${pad}px;z-index:1}
.topbar .lockup{margin:0}
.content p{display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.prices li{border-top-color:${surface.fg}33}`;
}

function editorialCss({ kit, surface, pad, radius, framed }: LayoutArgs): string {
  const height = MEDIA_HEIGHT[kit.style.density];
  return `
.media{height:${height}px;${framed ? `margin:${pad}px ${pad}px 0;border:1px solid ${surface.fg}59;border-radius:${Math.min(radius, 12)}px` : ""}}
.content{padding:${pad}px;color:${surface.fg}}
.lockup{margin-bottom:${Math.round(pad * 0.8)}px}`;
}

function splitCss({ kit, surface, pad, radius, framed }: LayoutArgs): string {
  return `
.card{display:grid;grid-template-columns:5fr 6fr;min-height:470px}
.media{height:100%;${framed ? `margin:${pad}px 0 ${pad}px ${pad}px;border:1px solid ${surface.fg}59;border-radius:${Math.min(radius, 12)}px` : ""}}
.content{padding:${pad}px;color:${surface.fg};display:flex;flex-direction:column;justify-content:center}
.prices{margin-top:${Math.round(pad * 0.6)}px}
@media(max-width:560px){.card{grid-template-columns:1fr}.media{min-height:220px;margin:${framed ? `${pad}px ${pad}px 0` : "0"}}}`;
}

const LAYOUT_CSS = { poster: posterCss, editorial: editorialCss, split: splitCss } as const;
