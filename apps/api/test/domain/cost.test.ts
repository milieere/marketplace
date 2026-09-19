import type { Offering, PriceUnit } from "@marketplace/contracts/brand-record";
import { describe, expect, it } from "vitest";
import { budgetLimit, totalCost } from "../../src/domain/cost";

const offer = (amount: number, unit: PriceUnit): Offering => ({
  id: "o",
  kind: "menu",
  name: "o",
  description: "",
  price: { amount, currency: "EUR", unit },
  attributes: {},
});

const friToSun = { start: "2026-09-18T15:00:00+02:00", end: "2026-09-20T11:00:00+02:00" };

describe("totalCost", () => {
  it("multiplies per-person prices by the number of people", () => {
    expect(totalCost(offer(28, "person"), 8)).toBe(224);
  });

  it("charges group and item prices once", () => {
    expect(totalCost(offer(46, "group"), 2)).toBe(46);
    expect(totalCost(offer(8, "item"), 4)).toBe(8);
  });

  it("counts nights from the visit, one if unknown", () => {
    expect(totalCost(offer(150, "night"), 2, friToSun)).toBe(300);
    expect(totalCost(offer(150, "night"), 2)).toBe(150);
  });

  it("counts started hours, one if unknown", () => {
    expect(totalCost(offer(10, "hour"), 1, { start: "2026-09-18T10:00:00Z", end: "2026-09-18T12:30:00Z" })).toBe(30);
    expect(totalCost(offer(10, "hour"), 1)).toBe(10);
  });
});

describe("budgetLimit", () => {
  it("scales a per-person budget to the number of people", () => {
    expect(budgetLimit({ amount: 30, per: "person" }, 8)).toBe(240);
    expect(budgetLimit({ amount: 50, per: "total" }, 2)).toBe(50);
  });
});
