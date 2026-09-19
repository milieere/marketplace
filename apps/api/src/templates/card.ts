import type { Artifact } from "@marketplace/contracts/artifact";
import type { BrandKit, BrandRecord, PriceUnit } from "@marketplace/contracts/brand-record";
import { palette } from "../domain/color";

export type CardInput = {
  record: BrandRecord;
  language: string;
  slots: Artifact["slots"];
  priceLines: Artifact["priceLines"];
  currency: string;
  photo?: { src: string; alt: string };
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function fontLink(kit: BrandKit): string {
  const families = [...new Set(kit.typography.map((t) => t.family))];
  const query = families.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;600;700`).join("&");
  return `<link href="https://fonts.googleapis.com/css2?${query}&display=swap" rel="stylesheet">`;
}

export function font(kit: BrandKit, role: "display" | "body"): string {
  const t = kit.typography.find((x) => x.role === role) ?? kit.typography.find((x) => x.role === "heading") ?? kit.typography[0]!;
  return `'${t.family}',${t.fallback}`;
}

const UNIT: Record<PriceUnit, string> = { person: " pp", group: "", night: " / night", item: "", hour: " / h" };
const FROM: Record<string, string> = { en: "from", es: "desde", ca: "des de", fr: "dès" };

function price(line: Artifact["priceLines"][number], currency: string, language: string): string {
  const amount = new Intl.NumberFormat(language, { style: "currency", currency, maximumFractionDigits: 0 }).format(line.amount);
  return `${line.from ? `${FROM[language] ?? FROM.en} ` : ""}${amount}${UNIT[line.unit]}`;
}

const CASE = { upper: "uppercase", title: "capitalize", sentence: "none" } as const;
const PADDING = { airy: 28, balanced: 22, dense: 16 } as const;

// No photo → brand-colour gradient
export function renderCard({ record, language, slots, priceLines, currency, photo }: CardInput): { html: string; colorPairs: [string, string][] } {
  const kit = record.brandKit;
  const { style } = kit;
  const p = palette(kit);
  const pad = PADDING[style.density];
  const side = style.composition === "image-side";
  const overlay = style.composition === "text-over-image";

  const hero =
    style.imageTreatment === "duotone"
      ? `linear-gradient(135deg,${p.primary} 0 50%,${p.background} 50% 100%)`
      : `linear-gradient(135deg,${p.primary},${p.accent})`;
  const ornament = {
    none: "",
    rule: `h1:after{content:'';display:block;width:48px;height:3px;background:${p.accent};margin-top:10px}`,
    pattern: `.hero:after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(45deg,${p.background}33 0 8px,transparent 8px 16px)}`,
    stamp: `.stamp{z-index:1;position:absolute;top:14px;right:14px;width:64px;height:64px;border-radius:50%;border:2px dashed ${p.cta.text};color:${p.cta.text};background:${p.cta.background};display:flex;align-items:center;justify-content:center;font:700 11px ${font(kit, "display")};transform:rotate(-12deg);text-align:center}`,
  }[style.ornament];

  const css = `
body{margin:0;font-family:${font(kit, "body")};background:${p.background};color:${p.text}}
.card{position:relative;max-width:${side ? 640 : 420}px;margin:0 auto;border-radius:${style.radius}px;overflow:hidden;background:${p.background};${side ? "display:grid;grid-template-columns:1fr 1fr;" : ""}}
.hero{position:relative;min-height:${overlay ? 220 : 170}px;background:${hero};${style.imageTreatment === "framed" ? `margin:${pad}px ${pad}px ${side ? pad : 0}px;border:1px solid ${p.text};border-radius:${style.radius}px;` : ""}${overlay ? "display:flex;align-items:flex-end;" : ""}}
.photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;${style.imageTreatment === "duotone" ? "filter:grayscale(1) contrast(1.15);mix-blend-mode:multiply;" : ""}}
.hero{isolation:isolate;overflow:hidden}${style.imageTreatment === "duotone" ? `.hero{background:${p.primary}}` : ""}
.hero h1{position:relative;z-index:1;margin:${pad}px;padding:8px 12px;background:${p.background};color:${p.text};border-radius:${Math.min(style.radius, 8)}px}
.content{padding:${pad}px}
.brand{font:700 13px ${font(kit, "display")};letter-spacing:.12em;text-transform:uppercase;opacity:.8}
h1{font-family:${font(kit, "display")};font-size:${style.density === "dense" ? 30 : 28}px;line-height:1.15;margin:8px 0 6px;text-transform:${CASE[style.headlineCase]}}
.sub{margin:0 0 12px;font-weight:600}
p{margin:0 0 14px;line-height:1.5}
.badge{display:inline-block;border:1px solid ${p.text};border-radius:999px;padding:3px 10px;font-size:12px;margin:0 6px 6px 0}
ul{list-style:none;padding:0;margin:10px 0 16px}li{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid ${p.text}33}
a.cta{display:block;text-align:center;background:${p.cta.background};color:${p.cta.text};text-decoration:none;font-weight:600;padding:12px;border-radius:${Math.min(style.radius, 12)}px}
${ornament}`;

  const headline = `<h1>${escapeHtml(slots.headline)}</h1>`;
  const body = [
    `<div class="brand">${escapeHtml(record.brand.name)}</div>`,
    overlay ? "" : headline,
    slots.subline ? `<div class="sub">${escapeHtml(slots.subline)}</div>` : "",
    `<p>${escapeHtml(slots.body)}</p>`,
    slots.badges.length ? `<div>${slots.badges.map((b) => `<span class="badge">${escapeHtml(b)}</span>`).join("")}</div>` : "",
    `<ul>${priceLines.map((l) => `<li><span>${escapeHtml(l.label)}</span><strong>${escapeHtml(price(l, currency, language))}</strong></li>`).join("")}</ul>`,
    `<a class="cta" href="${escapeHtml(slots.cta.url)}" target="_blank" rel="noopener">${escapeHtml(slots.cta.label)}</a>`,
  ].join("");

  const html = `<!doctype html><html lang="${escapeHtml(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${fontLink(kit)}<style>${css}</style></head><body><div class="card">
<div class="hero">${photo ? `<img class="photo" src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.alt)}">` : ""}${overlay ? headline : ""}${style.ornament === "stamp" ? `<div class="stamp">${escapeHtml(record.brand.name)}</div>` : ""}</div>
<div class="content">${body}</div></div></body></html>`;

  const colorPairs: [string, string][] = [
    [p.text, p.background],
    [p.cta.text, p.cta.background],
  ];
  return { html, colorPairs };
}
