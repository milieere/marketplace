import { describe, expect, it } from "vitest";
import { cmykToHex, contrast, palette, rgbToHex } from "../../src/domain/color";
import { loadRepository } from "../support";

describe("contrast", () => {
  it("follows WCAG", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21);
    expect(contrast("#777777", "#777777")).toBe(1);
  });
});

describe("colour conversion", () => {
  it("converts CMYK percentages and RGB to hex", () => {
    expect(cmykToHex([15, 0, 46, 58])).toBe("#5B6B3A");
    expect(cmykToHex([0, 0, 0, 100])).toBe("#000000");
    expect(rgbToHex([200, 85, 61])).toBe("#C8553D");
  });
});

describe("palette", () => {
  it("gives every brand readable text and a readable button, using only its own colours", async () => {
    const repo = await loadRepository();
    for (const record of [...(await repo.listVerified()), await repo.house()]) {
      const kit = record.brandKit;
      const p = palette(kit);
      const own = kit.colors.map((c) => c.hex);
      expect([p.text, p.background, p.cta.text, p.cta.background].every((c) => own.includes(c))).toBe(true);
      expect(contrast(p.text, p.background), record.brand.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.cta.text, p.cta.background), record.brand.id).toBeGreaterThanOrEqual(4.5);
    }
  });
});
