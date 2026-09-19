import { describe, expect, it } from "vitest";
import { loadRepository } from "../support";

describe("JSON brand repository over data/", () => {
  it("loads every seed brand without integrity issues", async () => {
    const repo = await loadRepository();
    const ids = (await repo.listVerified()).map((r) => r.brand.id).sort();
    expect(ids).toEqual(["bodega-pinyol", "cafe-lumen", "casa-brisa", "el-marcador", "grupo-mar", "hotel-albada", "nami-ramen", "terrat", "verde"]);
  });

  it("keeps the house brand out of matching", async () => {
    const repo = await loadRepository();
    expect((await repo.house()).brand.name).toBe("INTENT");
    expect((await repo.listVerified()).some((r) => r.brand.id === "_house")).toBe(false);
  });
});
