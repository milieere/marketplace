import { describe, expect, it } from "vitest";
import { checkBrandRecord } from "../../src/domain/brand-integrity";
import { loadRepository } from "../support";

async function casaBrisa() {
  const repo = await loadRepository();
  const record = await repo.get("casa-brisa");
  if (!record) throw new Error("casa-brisa missing");
  return { record: structuredClone(record), vocabulary: await repo.vocabulary("hospitality") };
}

describe("checkBrandRecord", () => {
  it("passes a valid record", async () => {
    const { record, vocabulary } = await casaBrisa();
    expect(checkBrandRecord(record, vocabulary)).toEqual([]);
  });

  it("catches a typo in an attribute value", async () => {
    const { record, vocabulary } = await casaBrisa();
    record.offerings[0]!.attributes.dietary = ["vegn"];
    expect(checkBrandRecord(record, vocabulary)).toContain('offering cb-sharing-menu: "vegn" is not a valid dietary');
  });

  it("catches an attribute on the wrong kind of entity", async () => {
    const { record, vocabulary } = await casaBrisa();
    record.locations[0]!.attributes.dietary = ["vegan"];
    expect(checkBrandRecord(record, vocabulary).join()).toContain('"dietary" does not apply to a location');
  });

  it("catches broken references", async () => {
    const { record, vocabulary } = await casaBrisa();
    record.brandKit.colors[0]!.pairsWith.push("purple");
    record.offerings[0]!.locationIds = ["nowhere"];
    record.evidence.push({ field: "offerings[ghost].price", documentId: "doc-offers", confidence: 1 });
    const issues = checkBrandRecord(record, vocabulary).join("\n");
    expect(issues).toContain('pairs with unknown color "purple"');
    expect(issues).toContain('unknown location "nowhere"');
    expect(issues).toContain('unknown offerings "ghost"');
  });
});
