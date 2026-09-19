import type { BrandRecord } from "@marketplace/contracts/brand-record";
import { Intent, type Need } from "@marketplace/contracts/intent";
import type { Vocabulary } from "@marketplace/contracts/vocabulary";
import { describe, expect, it } from "vitest";
import { checkBrandRecord } from "../../src/domain/brand-integrity";
import { matchNeed } from "../../src/domain/match";
import { loadRepository } from "../support";

type NeedInput = Partial<Omit<Need, "id">>;

function intentFor(need: NeedInput, extra: Partial<Intent>) {
  return Intent.parse({
    id: "i1",
    raw: { text: "", inputs: [] },
    scope: "in-domain",
    language: "en",
    phrases: [],
    missing: [],
    needs: [{ id: "n1", label: "outing", required: {}, preferred: {}, ...need }],
    ...extra,
  });
}

async function match(need: NeedInput, extra: Partial<Intent> = {}, industry?: { brands: BrandRecord[]; vocabulary: Vocabulary }) {
  const repo = await loadRepository();
  const intent = intentFor(need, extra);
  const brands = industry?.brands ?? (await repo.listVerified());
  const vocabulary = industry?.vocabulary ?? (await repo.vocabulary("hospitality"));
  const result = matchNeed(intent, intent.needs[0]!, brands, vocabulary);
  const reason = (brandId: string) => result.excluded.find((e) => e.brandId === brandId)?.reason;
  return { ...result, ids: result.matches.map((m) => m.record.brand.id), reason };
}

const FRI_21 = { start: "2026-09-18T21:00:00+02:00" };

describe("matchNeed (coverage matrix)", () => {
  it("Q1: vegan + gluten-free + terrace for 8 at ~€30 each", async () => {
    const r = await match(
      { when: FRI_21, required: { dietary: ["vegan", "gluten-free"], amenities: ["terrace"] } },
      { party: { size: 8 }, budget: { amount: 30, per: "person" } },
    );
    expect(r.closest).toBe(false);
    expect(r.ids.sort()).toEqual(["casa-brisa", "verde"]);
    expect(r.reason("nami-ramen")).toContain("amenities:terrace");
    for (const id of ["el-marcador", "grupo-mar", "terrat"]) expect(r.reason(id)).toContain("dietary:vegan");
  });

  it("Q2: a couple, €50 total, three hours tonight", async () => {
    const r = await match(
      {
        when: { start: "2026-09-18T20:30:00+02:00", end: "2026-09-18T23:30:00+02:00" },
        preferred: { occasion: ["date-night"], ambience: ["romantic"] },
      },
      { party: { size: 2 }, budget: { amount: 50, per: "total" } },
    );
    expect(r.ids).toEqual(expect.arrayContaining(["casa-brisa", "verde", "terrat", "nami-ramen"]));
    expect(r.reason("hotel-albada")).toContain("over budget");
    const casaBrisa = r.matches.find((m) => m.record.brand.id === "casa-brisa")!;
    expect(casaBrisa.offerings.map((o) => o.offering.id)).toEqual(["cb-tasting-for-two"]);
  });

  it("Q5: Sunday brunch with a wheelchair user", async () => {
    const r = await match(
      {
        when: { start: "2026-09-20T11:00:00+02:00" },
        required: { accessibility: ["wheelchair"] },
        preferred: { cuisine: ["brunch"], occasion: ["family"] },
      },
      { party: { size: 4, kids: 2 } },
    );
    expect(r.ids.sort()).toEqual(["cafe-lumen", "hotel-albada"]);
    expect(r.reason("casa-brisa")).toBe("closed at that time");
    expect(r.reason("terrat")).toContain("accessibility:wheelchair");
  });

  it("Q6: watch the game with 6 friends", async () => {
    const r = await match({ when: FRI_21, required: { amenities: ["tv-sports"] }, preferred: { cuisine: ["tapas"] } }, { party: { size: 6 } });
    expect(r.ids).toEqual(["el-marcador"]);
    for (const e of r.excluded) expect(e.reason).toContain("amenities:tv-sports");
  });

  it("Q7: quiet café with wifi and plugs, Monday morning", async () => {
    const r = await match(
      {
        when: { start: "2026-09-21T09:00:00+02:00", end: "2026-09-21T12:00:00+02:00" },
        required: { amenities: ["wifi", "power-outlets"] },
        preferred: { ambience: ["quiet"], occasion: ["work"] },
      },
      { party: { size: 1 } },
    );
    expect(r.ids).toEqual(["cafe-lumen"]);
    expect(r.matches[0]!.offerings[0]!.offering.id).toBe("cl-work-pass");
  });

  it("Q8: 12 people, private room, Saturday lunch, seafood preferred", async () => {
    const r = await match(
      {
        when: { start: "2026-09-19T13:30:00+02:00", end: "2026-09-19T16:00:00+02:00" },
        required: { amenities: ["private-room"] },
        preferred: { cuisine: ["seafood"], occasion: ["celebration"] },
      },
      { party: { size: 12 } },
    );
    expect(r.ids).toEqual(["grupo-mar", "casa-brisa"]);
    expect(r.matches[0]!.location?.id).toBe("mar-barceloneta");
    expect(r.matches[0]!.offerings[0]!.offering.id).toBe("gm-celebration");
  });

  it("Q9: ramen on a terrace falls back to the closest match and says so", async () => {
    const r = await match({ when: FRI_21, required: { cuisine: ["japanese"], amenities: ["terrace"] } }, { party: { size: 2 } });
    expect(r.closest).toBe(true);
    expect(r.ids).toEqual(["nami-ramen"]);
    for (const o of r.matches[0]!.offerings) {
      expect(o.relaxed).toEqual([{ needId: "n1", constraint: "amenities:terrace", from: "required", to: "dropped" }]);
    }
  });

  it("Q10: vegan for 25 under €10 each finds nothing; vegan is never dropped", async () => {
    const r = await match({ when: FRI_21, required: { dietary: ["vegan"] } }, { party: { size: 25 }, budget: { amount: 10, per: "person" } });
    expect(r.closest).toBe(true);
    expect(r.matches).toEqual([]);
    expect(r.reason("nami-ramen")).toContain("over budget");
  });
});

describe("matchNeed (closest match rules)", () => {
  it("allows 20 % over budget and records it only where it was needed", async () => {
    const r = await match({ when: FRI_21, required: { dietary: ["vegan"] } }, { party: { size: 8 }, budget: { amount: 13, per: "person" } });
    expect(r.closest).toBe(true);
    expect(r.ids).toEqual(["nami-ramen"]);
    expect(r.matches[0]!.offerings[0]!.relaxed).toEqual([{ needId: "n1", constraint: "budget", from: "104", to: "112" }]);
    expect(r.reason("verde")).toContain("over budget");
  });

  it("drops a place attribute but never accessibility", async () => {
    const r = await match({ when: FRI_21, required: { accessibility: ["wheelchair"], amenities: ["rooftop"] } }, { party: { size: 2 } });
    expect(r.closest).toBe(true);
    expect(r.ids).not.toContain("terrat");
    expect(r.ids).toContain("casa-brisa");
    expect(r.reason("terrat")).toContain("accessibility:wheelchair");
  });

  it("excludes what the user wants to avoid", async () => {
    const r = await match({ when: FRI_21, avoid: { ambience: ["lively"] } }, { party: { size: 2 } });
    expect(r.ids).toContain("verde");
    expect(r.reason("nami-ramen")).toBe("has ambience:lively");
  });
});

describe("matchNeed (another industry)", () => {
  const vocabulary: Vocabulary = {
    industry: "bike-rental",
    offeringKinds: ["rental", "product"],
    attributes: [
      { key: "category", description: "", values: ["city", "e-bike"], appliesTo: ["offering"], constraint: "hard", relaxable: true },
      { key: "frame-size", description: "", values: ["S", "M", "L", "XL"], appliesTo: ["offering"], constraint: "hard", relaxable: false },
      { key: "services", description: "", values: ["delivery", "repair"], appliesTo: ["location"], constraint: "hard", relaxable: true },
    ],
  };
  const weekdays = { from: "09:00", to: "19:00" };

  async function rodar(): Promise<BrandRecord> {
    const base = (await (await loadRepository()).get("casa-brisa"))!;
    return {
      ...base,
      brand: { id: "rodar", name: "Rodar", industry: "bike-rental", summary: "", languages: ["en"] },
      brandKit: { ...base.brandKit, photos: [] },
      locations: [
        {
          id: "rodar-poblenou",
          name: "Poblenou",
          address: "",
          timezone: "Europe/Madrid",
          openingHours: { mon: [weekdays], tue: [weekdays], wed: [weekdays], thu: [weekdays], fri: [weekdays], sat: [weekdays] },
          attributes: { services: ["repair"] },
        },
      ],
      offerings: [
        {
          id: "rd-ebike",
          kind: "rental",
          name: "E-bike",
          description: "",
          price: { amount: 4, currency: "EUR", unit: "hour" },
          attributes: { category: ["e-bike"], "frame-size": ["M", "L"] },
        },
      ],
      documents: [],
      evidence: [],
    };
  }

  const bikes = async () => ({ brands: [await rodar()], vocabulary });
  const weekend = { start: "2026-09-18T10:00:00+02:00", end: "2026-09-19T18:00:00+02:00" };

  it("accepts the brand data against its own vocabulary", async () => {
    expect(checkBrandRecord(await rodar(), vocabulary)).toEqual([]);
  });

  it("rents an e-bike over two days when pickup and return fall in opening hours", async () => {
    const r = await match(
      { kinds: ["rental"], when: weekend, required: { category: ["e-bike"], "frame-size": ["M"] } },
      { budget: { amount: 150, per: "total" } },
      await bikes(),
    );
    expect(r.ids).toEqual(["rodar"]);
    expect(r.matches[0]!.offerings[0]!.cost).toBe(128);
  });

  it("excludes a return on a day the shop is closed", async () => {
    const r = await match({ when: { ...weekend, end: "2026-09-20T12:00:00+02:00" } }, {}, await bikes());
    expect(r.reason("rodar")).toBe("closed at that time");
  });

  it("drops a place-only service in the closest match, never a product attribute", async () => {
    const delivery = await match({ required: { services: ["delivery"], "frame-size": ["M"] } }, {}, await bikes());
    expect(delivery.closest).toBe(true);
    expect(delivery.matches[0]!.offerings[0]!.relaxed.map((x) => x.constraint)).toEqual(["services:delivery"]);

    const xl = await match({ required: { services: ["delivery"], "frame-size": ["XL"] } }, {}, await bikes());
    expect(xl.matches).toEqual([]);
    expect(xl.reason("rodar")).toBe("missing frame-size:XL");
  });
});
