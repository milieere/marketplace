import type { Artifact } from "@marketplace/contracts/artifact";
import type { BrandRecord, Location } from "@marketplace/contracts/brand-record";
import { CARD_WIDTH, applyCase, cardCurrency, cardDesign, currencySymbol, escapeHtml, font, fontLink, formatPrice } from "./card";
import { editorialLayout, type EditorialLayout } from "./editorial";

export type EditorialCardInput = {
  record: BrandRecord;
  language: string;
  slots: Artifact["slots"];
  priceLines: Artifact["priceLines"];
  location?: Location;
  image?: string;
  logo?: string;
};

const PIN = `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>`;

const SCRIM: Record<EditorialLayout["scrim"], (deep: string, primary: string) => string> = {
  bottom: (deep, primary) => `linear-gradient(to top, ${deep} 4%, ${deep}E6 26%, ${primary}33 55%, ${deep}00 82%)`,
  top: (deep) => `linear-gradient(to bottom, ${deep}B3, ${deep}00 42%)`,
  left: (deep) => `linear-gradient(to right, ${deep}D9, ${deep}00 62%)`,
  right: (deep) => `linear-gradient(to left, ${deep}D9, ${deep}00 62%)`,
  none: () => "none",
};

const CORNER: Record<EditorialLayout["logoCorner"], string> = {
  "top-left": "top:var(--pad);left:var(--pad)",
  "top-right": "top:var(--pad);right:var(--pad);flex-direction:row-reverse",
  "bottom-left": "bottom:var(--pad);left:var(--pad)",
  "top-center": "top:var(--pad);left:50%;transform:translateX(-50%)",
};

function lockup(record: BrandRecord, logo: string | undefined): string {
  const mark = logo ? `<img class="mark" src="${escapeHtml(logo)}" alt="">` : "";
  return `<div class="lockup">${mark}<span>${escapeHtml(record.brand.name)}</span></div>`;
}

function priceBlock(input: EditorialCardInput, layout: EditorialLayout, currency: string): string {
  const { priceLines, language, location } = input;
  const line = priceLines[0];
  if (!line) return "";
  const amount = escapeHtml(formatPrice(line, currency, language));
  const level = location?.priceLevel ? `<span class="level">${escapeHtml(currencySymbol(currency, language).repeat(location.priceLevel))}</span>` : "";

  if (layout.priceStyle === "hero") {
    return `<div class="price hero"><strong>${amount}</strong><span class="offer">${escapeHtml(line.label)}</span>${level}</div>`;
  }
  if (layout.priceStyle === "editorial") {
    return `<div class="price editorial"><span class="offer">${escapeHtml(line.label)}</span><strong>${amount}</strong>${level}</div>`;
  }
  return `<div class="price inline"><span class="offer">${escapeHtml(line.label)}</span><strong>${amount}</strong>${level}</div>`;
}

function copyBlock(input: EditorialCardInput, layout: EditorialLayout, currency: string): string {
  const { slots, record, location } = input;
  const headline = applyCase(slots.headline, record.brandKit.style.headlineCase);
  const badges =
    layout.showBadges && slots.badges.length
      ? `<ul class="badges">${slots.badges.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
      : "";
  return [
    `<h1>${escapeHtml(headline)}</h1>`,
    layout.rule ? `<div class="rule"></div>` : "",
    layout.showSubline && slots.subline ? `<p class="sub">${escapeHtml(slots.subline)}</p>` : "",
    layout.showBody ? `<p class="body">${escapeHtml(slots.body)}</p>` : "",
    badges,
    location ? `<div class="place">${PIN}<span>${escapeHtml(location.name)}</span></div>` : "",
    priceBlock(input, layout, currency),
  ].join("");
}

export function renderEditorialCard(input: EditorialCardInput): string {
  const { record, language, image, logo } = input;
  const kit = record.brandKit;
  const style = kit.style;
  const d = cardDesign(kit);
  const p = d.palette;
  const layout = editorialLayout(kit);
  const currency = cardCurrency(record, input.priceLines);
  const over = layout.frame === "poster";
  const ink = over ? p.onDeep : p.text;
  const surface = over ? "transparent" : p.background;
  const pad = { airy: 34, balanced: 28, dense: 22 }[style.density];
  const head = Math.round(38 * layout.headlineScale);
  const upper = style.headlineCase === "upper";

  const seal = layout.stamp
    ? `<div class="seal"><span>${escapeHtml(kit.voice.doSay[0] ?? record.brand.name)}</span></div>`
    : "";

  const css = `
*{box-sizing:border-box}
:root{--pad:${pad}px}
body{margin:0;background:${p.background};font-family:${font(kit, "body")};-webkit-font-smoothing:antialiased}
.card{position:relative;width:${CARD_WIDTH[layout.frame]}px;margin:0 auto;background:${p.background};border-radius:${style.radius}px;overflow:hidden;color:${ink};display:grid}
.card[data-frame="poster"]{aspect-ratio:3/4}
.card[data-frame="editorial"]{grid-template-rows:${style.density === "dense" ? 46 : 54}% auto}
.card[data-frame="split"]{grid-template-columns:44% 56%;min-height:470px}
.media{position:relative;overflow:hidden;background:${p.deep}}
.card[data-frame="poster"] .media{position:absolute;inset:0}
.media img{width:100%;height:100%;object-fit:cover;display:block${style.imageTreatment === "duotone" ? `;filter:grayscale(1) contrast(1.15);mix-blend-mode:multiply` : ""}}
.card[data-treatment="duotone"] .media{background:${p.accent}}
.card[data-treatment="framed"] .media{margin:var(--pad);border-radius:${Math.min(style.radius, 12)}px;border:1px solid ${ink}2E}
.scrim{position:absolute;inset:0;pointer-events:none;background:${SCRIM[layout.scrim](p.deep, p.primary)}}
.copy{position:relative;z-index:2;padding:var(--pad);background:${surface};display:flex;flex-direction:column;justify-content:${over ? "flex-end" : "center"};align-items:${layout.align === "centre" ? "center" : "flex-start"};text-align:${layout.align === "centre" ? "center" : "left"};gap:0}
.card[data-frame="poster"] .copy{position:absolute;inset:auto 0 0 0;padding-top:calc(var(--pad) * 2)}
.lockup{position:absolute;z-index:3;display:flex;align-items:center;gap:10px;${CORNER[layout.logoCorner]}}
.lockup .mark{height:${style.density === "airy" ? 38 : 32}px;width:auto;display:block}
.lockup span{font:${Math.max(...(kit.typography.find((t) => t.role === "display")?.weights ?? [700]))} ${style.density === "airy" ? 17 : 15}px ${font(kit, "display")};text-transform:uppercase;letter-spacing:.18em;color:${over || layout.logoCorner === "top-center" ? p.onDeep : p.text}}
h1{margin:0;font-family:${font(kit, "display")};font-weight:${Math.max(...(kit.typography.find((t) => t.role === "display")?.weights ?? [700]))};font-size:${head}px;line-height:${upper ? 0.98 : 1.1};letter-spacing:${upper ? ".01em" : "-.015em"};text-transform:${upper ? "uppercase" : "none"};text-wrap:balance}
.rule{width:${Math.round(head * 1.5)}px;height:4px;background:${d.onSurfaceAccent};margin:18px 0 0;border-radius:2px}
.sub{margin:14px 0 0;font-size:16px;font-weight:600;opacity:.95}
.body{margin:10px 0 0;font-size:14px;line-height:1.55;opacity:.8;max-width:42ch}
.badges{display:flex;flex-wrap:wrap;gap:6px;margin:16px 0 0;padding:0;list-style:none}
.badges li{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;padding:5px 11px;border-radius:${style.radius >= 16 ? 999 : 4}px;background:${p.accent};color:${p.onAccent}}
.place{display:flex;align-items:center;gap:6px;margin:18px 0 0;font-size:13px;font-weight:600;opacity:.85}
.price{display:flex;align-items:baseline;gap:10px;margin-top:auto;padding-top:20px}
.card[data-frame="split"] .price,.card[data-frame="editorial"] .price{margin-top:22px;padding-top:0}
.price .offer{font-size:13px;opacity:.75}
.price .level{font-family:${font(kit, "display")};color:${d.levelColor};letter-spacing:.06em;margin-left:auto}
.price.hero{flex-direction:column;align-items:${layout.align === "centre" ? "center" : "flex-start"};gap:2px}
.price.hero strong{font-family:${font(kit, "display")};font-size:${Math.round(head * 0.92)}px;line-height:1;color:${d.onSurfaceAccent}}
.price.hero .level{margin:6px 0 0}
.price.editorial strong{font-family:${font(kit, "display")};font-size:26px;letter-spacing:-.01em}
.price.inline strong{font-family:${font(kit, "display")};font-size:19px}
.seal{position:absolute;z-index:3;top:var(--pad);right:var(--pad);width:86px;height:86px;border-radius:50%;background:${p.accent};color:${p.onAccent};display:grid;place-items:center;text-align:center;padding:10px;transform:rotate(-8deg);font:${Math.max(...(kit.typography.find((t) => t.role === "display")?.weights ?? [700]))} 12px/1.15 ${font(kit, "display")};text-transform:uppercase;letter-spacing:.07em}`;

  const media = `<div class="media">${image ? `<img src="${escapeHtml(image)}" alt="">` : ""}<div class="scrim"></div></div>`;

  return `<!doctype html><html lang="${escapeHtml(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${fontLink(kit)}<style>${css}</style></head><body>
<div class="card" data-frame="${layout.frame}" data-treatment="${style.imageTreatment}">${media}${lockup(record, logo)}${seal}<div class="copy">${copyBlock(input, layout, currency)}</div></div>
</body></html>`;
}
