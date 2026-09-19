import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BrandRecord } from "@marketplace/contracts/brand-record";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../../src/config";
import { createApp } from "../../../src/http/app";
import type { BrandRepository } from "../../../src/ports/brand-repository";
import { DATA_DIR, loadRepository } from "../../support";

const draft = (): BrandRecord => ({
  ...(JSON.parse(readFileSync(join(DATA_DIR, "brands", "verde.json"), "utf8")) as BrandRecord),
  status: "draft",
  reviewNotes: ["Colour 'Leaf' was only given in CMYK; converted. Please confirm."],
});

async function app() {
  const saved: BrandRecord[] = [];
  const repository = await loadRepository();
  const brands: BrandRepository = { ...repository, save: async (record) => void saved.push(record) };
  return { app: createApp(loadConfig({ NEBIUS_API_KEY: "test" }), { brands }), saved };
}

const post = (a: ReturnType<typeof createApp>, path: string, body: unknown) =>
  a.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("POST /v1/brands/:id/verify", () => {
  it("stores the reviewed draft as verified", async () => {
    const { app: a, saved } = await app();
    const res = await post(a, "/v1/brands/verde/verify", draft());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "verde", status: "verified", offerings: draft().offerings.length });
    expect(saved).toHaveLength(1);
    expect(saved[0]!.status).toBe("verified");
  });

  it("refuses a record whose id doesn't match the path", async () => {
    const { app: a, saved } = await app();
    const res = await post(a, "/v1/brands/casa-brisa/verify", draft());

    expect(res.status).toBe(400);
    expect(saved).toEqual([]);
  });

  it("refuses a record that breaks the vocabulary, with the issues", async () => {
    const { app: a, saved } = await app();
    const broken = draft();
    broken.offerings[0]!.attributes = { dietary: ["carnivore"] };
    const res = await post(a, "/v1/brands/verde/verify", broken);

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: "invalid_record" });
    expect(saved).toEqual([]);
  });
});
