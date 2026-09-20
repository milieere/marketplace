import type { BrandKit } from "@marketplace/contracts/brand-record";
import type { VisualGenerator } from "../../ports/visual-generator";

function color(kit: BrandKit, role: string, fallback: string): string {
  return kit.colors.find((c) => c.role === role)?.hex ?? fallback;
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function encodeSvg(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function promptSummary(input: Parameters<VisualGenerator["generate"]>[0]): string {
  const kit = input.record.brandKit;
  const palette = kit.colors.map((c) => `${c.role}:${c.hex}`).join(", ");
  const needs = input.intent.needs.map((n) => n.label).join(", ");
  return [
    `Brand-safe generated visual for ${input.record.brand.name}.`,
    `Intent: ${input.intent.raw.text}.`,
    `Needs: ${needs || "hospitality recommendation"}.`,
    `Palette: ${palette}.`,
    `Imagery style: ${kit.imagery.style}.`,
    `Avoid: ${kit.imagery.avoid.join(", ") || "text, logos, numbers"}.`,
    "No embedded copy, logo, price or readable text; frontend overlays grounded copy and price.",
  ].join(" ");
}

export function createSvgVisualGenerator(): VisualGenerator {
  return {
    async generate(input) {
      const kit = input.record.brandKit;
      const primary = color(kit, "primary", "#1F98B9");
      const secondary = color(kit, "secondary", primary);
      const accent = color(kit, "accent", primary);
      const background = color(kit, "background", "#F4F8FF");
      const text = color(kit, "text", "#08233E");
      const density = kit.style.density;
      const treatment = kit.style.imageTreatment;
      const ornament = kit.style.ornament;
      const seed = [...input.artifact.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const tilt = (seed % 18) - 9;
      const patternOpacity = density === "dense" ? 0.28 : density === "airy" ? 0.12 : 0.18;
      const duotone = treatment === "duotone";

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" role="img" aria-label="${escapeXml(input.record.brand.name)} generated brand visual">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${duotone ? primary : background}"/>
      <stop offset="0.52" stop-color="${duotone ? secondary : primary}"/>
      <stop offset="1" stop-color="${secondary}"/>
    </linearGradient>
    <radialGradient id="glow" cx="26%" cy="24%" r="70%">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.7"/>
      <stop offset="0.38" stop-color="${accent}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grain" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M0 31.5h32M31.5 0v32" stroke="${text}" stroke-opacity="${patternOpacity}" stroke-width="1"/>
    </pattern>
    <filter id="soft"><feGaussianBlur stdDeviation="22"/></filter>
  </defs>
  <rect width="1200" height="900" fill="url(#bg)"/>
  <rect width="1200" height="900" fill="url(#glow)"/>
  ${ornament === "pattern" ? `<rect width="1200" height="900" fill="url(#grain)" opacity="0.42"/>` : ""}
  <g transform="rotate(${tilt} 600 450)" opacity="0.92">
    <ellipse cx="350" cy="560" rx="300" ry="82" fill="${text}" opacity="0.15" filter="url(#soft)"/>
    <ellipse cx="345" cy="470" rx="260" ry="92" fill="${background}" opacity="0.58"/>
    <ellipse cx="345" cy="452" rx="210" ry="62" fill="${accent}" opacity="0.38"/>
    <circle cx="220" cy="360" r="72" fill="${primary}" opacity="0.9"/>
    <circle cx="470" cy="350" r="50" fill="${secondary}" opacity="0.82"/>
    <path d="M160 635 C290 570 460 710 610 620 S860 560 1030 665" fill="none" stroke="${accent}" stroke-width="24" stroke-linecap="round" opacity="0.62"/>
    <path d="M130 695 C280 625 430 770 620 692 S890 625 1080 742" fill="none" stroke="${background}" stroke-width="10" stroke-linecap="round" opacity="0.45"/>
  </g>
  <g opacity="${density === "airy" ? "0.36" : "0.52"}">
    <circle cx="930" cy="190" r="170" fill="${accent}" opacity="0.36"/>
    <circle cx="1030" cy="295" r="72" fill="${background}" opacity="0.26"/>
    <rect x="746" y="536" width="360" height="230" rx="${Math.max(12, kit.style.radius)}" fill="${background}" opacity="0.14"/>
  </g>
  ${ornament === "rule" ? `<path d="M738 636h320" stroke="${accent}" stroke-width="8" stroke-linecap="round" opacity="0.76"/>` : ""}
  ${ornament === "stamp" ? `<circle cx="990" cy="190" r="86" fill="none" stroke="${accent}" stroke-width="8" stroke-dasharray="14 10" opacity="0.78"/>` : ""}
  <rect width="1200" height="900" fill="${text}" opacity="0.04"/>
</svg>`;

      return {
        artifactId: input.artifact.id,
        imageUrl: encodeSvg(svg),
        prompt: promptSummary(input),
      };
    },
  };
}
