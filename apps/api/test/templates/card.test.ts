import { describe, expect, it } from "vitest";
import { palette } from "../../src/domain/color";
import { renderCard } from "../../src/templates/card";
import { loadRepository } from "../support";

describe("renderCard", () => {
  it("renders every brand with its own colours and fonts, and prices from the data", async () => {
    for (const record of await (await loadRepository()).listVerified()) {
      const offering = record.offerings[0]!;
      const { html } = renderCard({
        record,
        language: "en",
        slots: { headline: "Hello", body: "Body", badges: ["Terrace"], cta: { label: "Book", url: "https://x.example" } },
        priceLines: [{ offeringId: offering.id, label: offering.name, amount: offering.price.amount, unit: offering.price.unit, from: false }],
        currency: offering.price.currency,
      });
      const p = palette(record.brandKit);
      expect(html).toContain(p.background);
      expect(html).toContain(record.brandKit.typography[0]!.family);
      expect(html).toContain(`€${offering.price.amount}`);
    }
  });

  it("escapes copy", async () => {
    const record = (await (await loadRepository()).get("verde"))!;
    const { html } = renderCard({
      record,
      language: "en",
      slots: { headline: "<script>x</script>", body: "b", badges: [], cta: { label: "c", url: "#" } },
      priceLines: [],
      currency: "EUR",
    });
    expect(html).not.toContain("<script>");
  });
});
