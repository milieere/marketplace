import type { Need } from "@marketplace/contracts/intent";
import { describe, expect, it } from "vitest";
import { rankPhotos } from "../../src/domain/photo";
import { loadRepository } from "../support";

const need = (over: Partial<Need> = {}): Need => ({ id: "n1", label: "x", required: {}, preferred: {}, avoid: {}, wishes: [], brandIds: [], ...over });

async function brand(id: string) {
  return (await (await loadRepository()).get(id))!;
}

describe("rankPhotos", () => {
  it("picks the group-on-a-terrace photo for 8 friends asking for a terrace", async () => {
    const r = await brand("casa-brisa");
    const ids = rankPhotos(r.brandKit.photos, { size: 8 }, [need({ required: { amenities: ["terrace"] } })], r.locations[0]).map((p) => p.id);
    expect(ids[0]).toBe("terrace-group");
  });

  it("picks the couple photo for a date night", async () => {
    const r = await brand("hotel-albada");
    const ids = rankPhotos(r.brandKit.photos, { size: 2 }, [need({ preferred: { occasion: ["date-night"] } })], r.locations[0]).map((p) => p.id);
    expect(ids[0]).toBe("candle-dinner");
  });

  it("still ranks every photo when nothing matches, so a photo is always shown", async () => {
    const r = await brand("verde");
    expect(rankPhotos(r.brandKit.photos, undefined, [need()], r.locations[0])).toHaveLength(3);
  });

  it("never shows an amenity the location lacks", async () => {
    const r = await brand("grupo-mar");
    const gracia = r.locations.find((l) => l.id === "mar-gracia")!;
    expect(rankPhotos(r.brandKit.photos, { size: 12 }, [need({ required: { amenities: ["private-room"] } })], gracia)).toEqual([]);
  });
});
