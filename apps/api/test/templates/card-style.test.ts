import { describe, expect, it } from "vitest";
import { contrast } from "../../src/domain/color";
import { renderCardStyle, type CardTokens } from "../../src/templates/card-style";
import { loadRepository } from "../support";

const ANCHORS = ["bottom", "lower-third", "top", "centre-left", "bottom-left", "bottom-right"] as const;
const LOCKUPS = ["top-left", "top-right", "top-centre", "bottom-left"] as const;
const PRICES = ["hero", "inline", "corner-mark"] as const;
const STRENGTHS = ["light", "medium", "heavy"] as const;
const SIZES = ["s", "m", "l", "xl"] as const;

function tokens(over: Partial<CardTokens> = {}): CardTokens {
  return {
    copyAnchor: "bottom",
    lockup: "top-left",
    scrimStrength: "medium",
    scrimColour: "#2B2118",
    headlineSize: "l",
    headlineUpper: false,
    headlineTracking: "normal",
    headlineColour: "#F6EFE6",
    bodyColour: "#F6EFE6",
    accent: "#F2A541",
    priceTreatment: "hero",
    priceColour: "#F2A541",
    badges: "solid",
    rule: true,
    align: "left",
    ...over,
  };
}

describe("renderCardStyle", () => {
  it("never lets the scrim become a solid field", async () => {
    const record = (await (await loadRepository()).get("casa-brisa"))!;
    for (const scrimStrength of STRENGTHS) {
      const css = renderCardStyle(record.brandKit, tokens({ scrimStrength }));
      const scrim = css.split("\n").find((l) => l.startsWith(".card .scrim"))!;
      expect(scrim, scrimStrength).toContain("linear-gradient");
      // it must fade to fully transparent, so the photograph always shows through
      expect(scrim, scrimStrength).toMatch(/,0\)/);
      const peaks = [...scrim.matchAll(/rgba\([^)]*,([\d.]+)\)/g)].map((m) => Number(m[1]));
      expect(Math.max(...peaks), scrimStrength).toBeLessThan(1);
    }
  });

  it("produces valid geometry for every combination", async () => {
    const record = (await (await loadRepository()).get("casa-brisa"))!;
    for (const copyAnchor of ANCHORS) {
      for (const lockup of LOCKUPS) {
        for (const priceTreatment of PRICES) {
          for (const headlineSize of SIZES) {
            const css = renderCardStyle(record.brandKit, tokens({ copyAnchor, lockup, priceTreatment, headlineSize }));
            const label = `${copyAnchor}/${lockup}/${priceTreatment}/${headlineSize}`;
            expect(css, label).toContain(".card .copy{position:absolute;");
            expect(css, label).toContain("padding:28px");
            expect(css, label).toContain("overflow:hidden");
            expect(css, label).not.toMatch(/undefined|NaN/);
          }
        }
      }
    }
  });

  it("swaps a colour the brand chose if it would be unreadable", async () => {
    const record = (await (await loadRepository()).get("casa-brisa"))!;
    // ink deliberately the same as the scrim
    const css = renderCardStyle(record.brandKit, tokens({ scrimColour: "#2B2118", headlineColour: "#2B2118" }));
    const headline = css.split("\n").find((l) => l.startsWith(".card .headline{"))!;
    const used = headline.match(/color:(#[0-9A-F]{6})/i)![1]!;
    expect(contrast(used, "#2B2118")).toBeGreaterThanOrEqual(4.5);
  });

  it("falls back to the brand palette when a colour is not one of its own", async () => {
    const record = (await (await loadRepository()).get("casa-brisa"))!;
    const css = renderCardStyle(record.brandKit, tokens({ accent: "#FF00FF" }));
    expect(css).not.toContain("#FF00FF");
  });

  it("gives two brands visibly different cards from the same tokens", async () => {
    const repo = await loadRepository();
    const a = renderCardStyle((await repo.get("casa-brisa"))!.brandKit, tokens());
    const b = renderCardStyle((await repo.get("nami-ramen"))!.brandKit, tokens());
    expect(a).not.toEqual(b);
  });
});
