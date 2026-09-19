import type { NoMatch } from "@marketplace/contracts/artifact";
import type { BrandRecord } from "@marketplace/contracts/brand-record";
import { palette } from "../domain/color";
import { escapeHtml, font, fontLink } from "./card";

export function renderFallback(house: BrandRecord, language: string, message: string, suggestions: NoMatch["suggestions"]): string {
  const kit = house.brandKit;
  const p = palette(kit);
  const css = `
body{margin:0;font-family:${font(kit, "body")};background:${p.background};color:${p.text}}
.box{max-width:420px;margin:0 auto;padding:32px 24px}
.brand{font:700 13px ${font(kit, "display")};letter-spacing:.12em;text-transform:uppercase;color:${p.primary}}
h1{font-family:${font(kit, "display")};font-size:24px;line-height:1.25;margin:10px 0 18px}
li{list-style:none;margin:0 0 10px;padding:12px 14px;border:1px solid ${p.text}44;border-radius:${kit.style.radius}px}
ul{padding:0}`;
  return `<!doctype html><html lang="${escapeHtml(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${fontLink(kit)}<style>${css}</style></head><body><div class="box">
<div class="brand">${escapeHtml(house.brand.name)}</div><h1>${escapeHtml(message)}</h1>
<ul>${suggestions.map((s) => `<li>${escapeHtml(s.label)}</li>`).join("")}</ul></div></body></html>`;
}
