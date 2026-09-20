import type { BrandKit } from "@marketplace/contracts/brand-record";
import { contrast } from "../domain/color";
import { cardDesign, font } from "./card";

export type CopyAnchor = "bottom" | "lower-third" | "top" | "centre-left" | "bottom-left" | "bottom-right";
export type LockupSpot = "top-left" | "top-right" | "top-centre" | "bottom-left";
export type Strength = "light" | "medium" | "heavy";
export type SizeStep = "s" | "m" | "l" | "xl";
export type PriceTreatment = "hero" | "inline" | "corner-mark";

export type CardTokens = {
  copyAnchor: CopyAnchor;
  lockup: LockupSpot;
  scrimStrength: Strength;
  scrimColour: string;
  headlineSize: SizeStep;
  headlineUpper: boolean;
  headlineTracking: "tight" | "normal" | "wide";
  headlineColour: string;
  bodyColour: string;
  accent: string;
  priceTreatment: PriceTreatment;
  priceColour: string;
  badges: "solid" | "outline" | "none";
  rule: boolean;
  align: "left" | "centre";
};

const PAD = 28;
const CARD_H = 573;
const HEADLINE = { s: 34, m: 40, l: 48, xl: 56 } as const;
const TRACKING = { tight: "-.02em", normal: "0", wide: ".04em" } as const;
// Capped: a solid scrim would hide the photograph
const PEAK = { light: 0.68, medium: 0.84, heavy: 0.94 } as const;
const REACH = { light: "52%", medium: "64%", heavy: "76%" } as const;

const EDGE: Record<CopyAnchor, "bottom" | "top" | "left"> = {
  bottom: "bottom",
  "lower-third": "bottom",
  "bottom-left": "bottom",
  "bottom-right": "bottom",
  top: "top",
  "centre-left": "left",
};

const TO: Record<"bottom" | "top" | "left", string> = { bottom: "to top", top: "to bottom", left: "to right" };

const PLACE: Record<CopyAnchor, string> = {
  bottom: `left:0;right:0;bottom:0`,
  "lower-third": `left:0;right:0;bottom:0;max-height:62%`,
  "bottom-left": `left:0;bottom:0;width:78%`,
  "bottom-right": `right:0;bottom:0;width:78%;text-align:right`,
  top: `left:0;right:0;top:0`,
  "centre-left": `left:0;top:50%;transform:translateY(-50%);width:74%`,
};

const LOCKUP: Record<LockupSpot, string> = {
  "top-left": `top:${PAD}px;left:${PAD}px`,
  "top-right": `top:${PAD}px;right:${PAD}px;flex-direction:row-reverse`,
  "top-centre": `top:${PAD}px;left:50%;transform:translateX(-50%)`,
  "bottom-left": `bottom:${PAD}px;left:${PAD}px`,
};

function hex(value: string, palette: string[], fallback: string): string {
  const clean = value?.trim().toUpperCase();
  return palette.some((p) => p.toUpperCase() === clean) ? clean : fallback;
}

function rgba(color: string, alpha: number): string {
  const n = Number.parseInt(color.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// Text sits on the scrim's strongest end
function readable(ink: string, over: string, kit: BrandKit): string {
  if (contrast(ink, over) >= 4.5) return ink;
  return [...kit.colors].map((c) => c.hex).sort((a, b) => contrast(b, over) - contrast(a, over))[0]!;
}

// The shell's reset uses `.card .x`, so these must match it or lose on specificity
function scope(css: string): string {
  return css.replace(/^\./gm, ".card .");
}

export function renderCardStyle(kit: BrandKit, tokens: CardTokens): string {
  const d = cardDesign(kit);
  const palette = kit.colors.map((c) => c.hex);
  const scrim = hex(tokens.scrimColour, palette, d.palette.deep);
  const accent = hex(tokens.accent, palette, d.palette.accent);
  const ink = readable(hex(tokens.headlineColour, palette, d.palette.onDeep), scrim, kit);
  const body = readable(hex(tokens.bodyColour, palette, ink), scrim, kit);
  const price = readable(hex(tokens.priceColour, palette, accent), scrim, kit);

  const edge = EDGE[tokens.copyAnchor];
  const peak = PEAK[tokens.scrimStrength];
  const head = HEADLINE[tokens.headlineSize];
  const centred = tokens.align === "centre";

  const priceCss = {
    hero: `.price{font:950 ${Math.round(head * 1.55)}px/0.88 ${font(kit, "display")};color:${price};margin-top:16px;letter-spacing:-.01em}`,
    inline: `.price{font:900 ${Math.round(head * 1.02)}px/0.95 ${font(kit, "display")};color:${price};margin-top:12px;letter-spacing:-.01em}`,
    "corner-mark": `.price{position:absolute;top:${PAD}px;right:${PAD}px;font:950 ${Math.round(head * 0.98)}px/0.95 ${font(kit, "display")};color:${price};background:${rgba(scrim, 0.9)};padding:12px 18px;border-radius:999px;margin:0;letter-spacing:-.01em}`,
  }[tokens.priceTreatment];


  const badgeCss = {
    solid: `.badges li{background:${accent};color:${d.palette.onAccent};border-radius:999px;padding:5px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}`,
    outline: `.badges li{border:1px solid ${rgba(ink, 0.45)};color:${ink};border-radius:999px;padding:5px 12px;font-size:11px;font-weight:600}`,
    none: `.badges{display:none}`,
  }[tokens.badges];

  return scope(`
.scrim{background:linear-gradient(${TO[edge]},${rgba(scrim, peak)} 0%,${rgba(scrim, peak * 0.86)} 26%,${rgba(scrim, 0)} ${REACH[tokens.scrimStrength]})}
.lockup{position:absolute;display:flex;align-items:center;gap:10px;${LOCKUP[tokens.lockup]}}
.mark{height:34px;width:auto;display:block}
.name{font:700 15px ${font(kit, "display")};letter-spacing:.18em;text-transform:uppercase;color:${ink}}
.copy{position:absolute;${PLACE[tokens.copyAnchor]};padding:${PAD}px;display:flex;flex-direction:column;align-items:${centred ? "center" : "flex-start"};text-align:${centred ? "center" : "inherit"};color:${body};max-height:${CARD_H - PAD}px;overflow:hidden}
.headline{font:900 ${head}px/${tokens.headlineUpper ? 0.98 : 1.04} ${font(kit, "display")};letter-spacing:${TRACKING[tokens.headlineTracking]};text-transform:${tokens.headlineUpper ? "uppercase" : "none"};color:${ink};margin:0;text-wrap:balance}
${tokens.rule ? `.headline::after{content:"";display:block;width:${Math.round(head * 1.4)}px;height:4px;background:${accent};margin-top:14px;border-radius:2px}` : ""}
.subline{font-size:17px;font-weight:750;color:${accent};margin:14px 0 0}
.body{font-size:14px;line-height:1.5;color:${body};opacity:.88;margin:10px 0 0;max-width:40ch}
.badges{display:flex;flex-wrap:wrap;gap:6px;margin:16px 0 0;padding:0}
${badgeCss}
.place{font-size:15px;font-weight:750;color:${body};opacity:.9;margin:16px 0 0}
.offer{font-size:15px;font-weight:700;color:${body};opacity:.78;margin:10px 0 0}
${priceCss}`).trim();
}
