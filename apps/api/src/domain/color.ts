import type { BrandKit } from "@marketplace/contracts/brand-record";

type Color = BrandKit["colors"][number];

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function byRole(kit: BrandKit, role: Color["role"]): Color | undefined {
  return kit.colors.find((c) => c.role === role);
}

function mostReadableOn(kit: BrandKit, background: string): string {
  return kit.colors.map((c) => c.hex).sort((a, b) => contrast(b, background) - contrast(a, background))[0]!;
}

export type Palette = { background: string; text: string; primary: string; accent: string; cta: { background: string; text: string } };

// Brand colours only; weak primary → CTA inverts text/background
export function palette(kit: BrandKit, minContrast = 4.5): Palette {
  const background = (byRole(kit, "background") ?? kit.colors[0]!).hex;
  const textRole = byRole(kit, "text")?.hex;
  const text = textRole && contrast(textRole, background) >= minContrast ? textRole : mostReadableOn(kit, background);
  const primary = (byRole(kit, "primary") ?? kit.colors[0]!).hex;
  const accent = (byRole(kit, "accent") ?? byRole(kit, "secondary") ?? byRole(kit, "primary") ?? kit.colors[0]!).hex;
  const onPrimary = mostReadableOn(kit, primary);
  const cta =
    contrast(onPrimary, primary) >= minContrast ? { background: primary, text: onPrimary } : { background: text, text: background };
  return { background, text, primary, accent, cta };
}
