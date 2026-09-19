import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BrandRecord, Offering } from "../src/brand-record";

const example = BrandRecord.parse(
  JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "..", "data/brands/casa-brisa.json"), "utf8")),
);

const offering = (price: object) =>
  Offering.safeParse({ id: "o1", kind: "product", name: "Gravel X2", description: "", price, attributes: {} });

describe("Offering price", () => {
  it("accepts any ISO currency and non-hospitality units", () => {
    expect(offering({ amount: 1290, currency: "USD", unit: "item" }).success).toBe(true);
    expect(offering({ amount: 40, currency: "EUR", unit: "hour" }).success).toBe(true);
  });

  it("rejects a malformed currency or an unknown unit", () => {
    expect(offering({ amount: 10, currency: "euro", unit: "item" }).success).toBe(false);
    expect(offering({ amount: 10, currency: "EUR", unit: "month" }).success).toBe(false);
  });
});

describe("BrandRecord", () => {
  it("allows an online-only brand with no locations", () => {
    expect(BrandRecord.safeParse({ ...example, locations: [] }).success).toBe(true);
  });
});
