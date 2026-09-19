import { describe, expect, it } from "vitest";
import { contrast, palette } from "../../src/domain/color";
import { loadRepository } from "../support";

describe("contrast", () => {
  it("follows WCAG", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21);
    expect(contrast("#777777", "#777777")).toBe(1);
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
