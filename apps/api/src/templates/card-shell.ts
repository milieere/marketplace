import type { Artifact } from "@marketplace/contracts/artifact";
import type { BrandRecord, Location } from "@marketplace/contracts/brand-record";
import { applyCase, cardCurrency, cardDesign, currencySymbol, escapeHtml, fontLink, formatPrice } from "./card";

export type CardShellInput = {
  record: BrandRecord;
  language: string;
  slots: Artifact["slots"];
  priceLines: Artifact["priceLines"];
  location?: Location;
  image?: string;
  logo?: string;
  css: string;
};

// The card owns its own size: generated CSS often floats everything, which collapses it
// One vertical format for every brand: the differences must come from the design,
// not from the card being a different shape
const CARD_W = 430;
const CARD_ASPECT = "3/4";

// Markup is ours so the strings stay exact; only the stylesheet is generated
export function renderCardShell(input: CardShellInput): string {
  const { record, language, slots, priceLines, location, image, logo, css } = input;
  const kit = record.brandKit;
  const d = cardDesign(kit);
  const currency = cardCurrency(record, priceLines);
  const line = priceLines[0];
  const headline = applyCase(slots.headline, kit.style.headlineCase);
  const shows = new Set(kit.advertising?.shows ?? ["subline", "body", "place", "price"]);
  const level = location?.priceLevel ? currencySymbol(currency, language).repeat(location.priceLevel) : undefined;

  const body = [
    `<h1 class="headline">${escapeHtml(headline)}</h1>`,
    shows.has("subline") && slots.subline && slots.subline !== line?.label ? `<p class="subline">${escapeHtml(slots.subline)}</p>` : "",
    shows.has("body") ? `<p class="body">${escapeHtml(slots.body)}</p>` : "",
    shows.has("badges") && slots.badges.length ? `<ul class="badges">${slots.badges.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>` : "",
    shows.has("place") && location ? `<p class="place">${escapeHtml(location.name)}${level && shows.has("priceLevel") ? ` <span class="level">${escapeHtml(level)}</span>` : ""}</p>` : "",
    shows.has("price") && line ? `<p class="offer">${escapeHtml(line.label)}</p>` : "",
    shows.has("price") && line ? `<p class="price">${escapeHtml(formatPrice(line, currency, language))}</p>` : "",
  ].join("");

  const reset = `
*{box-sizing:border-box}
body{margin:0;background:${d.palette.background};display:grid;place-items:start center;padding:24px}
.card{position:relative;width:${CARD_W}px;aspect-ratio:${CARD_ASPECT};border-radius:${kit.style.radius}px;overflow:hidden;isolation:isolate}
.card .media{position:absolute!important;inset:0!important;margin:0!important;width:auto!important;height:auto!important;z-index:0}
.card .photo{display:block!important;width:100%!important;height:100%!important;object-fit:cover!important}
.card .scrim{position:absolute!important;inset:0!important;display:block}
.card .lockup,.card .copy{position:relative;z-index:2}
.card .headline{overflow-wrap:anywhere;hyphens:auto}
.card .copy{display:flex;flex-direction:column}
.card .copy>*{position:relative!important;inset:auto!important;float:none!important;max-width:100%}
.card ul{list-style:none}
.card h1,.card p,.card ul{margin:0}`;

  return `<!doctype html><html lang="${escapeHtml(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${fontLink(kit)}<style>${reset}</style><style>${css}</style></head><body>
<article class="card">
  <figure class="media">${image ? `<img class="photo" src="${escapeHtml(image)}" alt="">` : ""}<span class="scrim"></span></figure>
  <header class="lockup">${logo ? `<img class="mark" src="${escapeHtml(logo)}" alt="">` : ""}<span class="name">${escapeHtml(record.brand.name)}</span></header>
  <div class="copy">${body}</div>
</article>
</body></html>`;
}
