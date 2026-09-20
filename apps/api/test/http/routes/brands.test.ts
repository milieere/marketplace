import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BrandRecord } from "@marketplace/contracts/brand-record";
import { describe, expect, it } from "vitest";
import type { BrandAgent } from "../../../src/agents/brand/brand-agent";
import { loadConfig } from "../../../src/config";
import { createApp } from "../../../src/http/app";
import type { BrandRepository } from "../../../src/ports/brand-repository";
import type { SourceFile, SourcePacks } from "../../../src/ports/source-packs";
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

function uploadApp() {
  const saved: { brandId: string; files: SourceFile[] }[] = [];
  const ingested: string[] = [];
  const sources: SourcePacks = {
    load: async () => undefined,
    save: async (brandId, files) => void saved.push({ brandId, files }),
  };
  const brandAgent: BrandAgent = {
    async *run({ brandId }) {
      ingested.push(brandId);
      yield { type: "step", agent: "brand", id: "read", label: "Reading", status: "started" };
      yield { type: "done" };
    },
  };
  return { app: createApp(loadConfig({ NEBIUS_API_KEY: "test" }), { brandAgent, sources }), saved, ingested };
}

function upload(brandId: string | undefined, files: [string, Uint8Array][]) {
  const body = new FormData();
  if (brandId !== undefined) body.set("brandId", brandId);
  for (const [name, bytes] of files) body.append("files", new File([bytes.buffer as ArrayBuffer], name));
  return { method: "POST", body } satisfies RequestInit;
}

const pdf = (): [string, Uint8Array] => ["brand-guidelines.pdf", new TextEncoder().encode("%PDF-1.4")];

describe("POST /v1/brands/ingest/upload", () => {
  it("writes the pack, then ingests it by id", async () => {
    const { app: a, saved, ingested } = uploadApp();
    const res = await a.request("/v1/brands/ingest/upload", upload("casa-nueva", [pdf(), ["photos/terrace.jpg", new Uint8Array(3)]]));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(saved).toHaveLength(1);
    expect(saved[0]!.brandId).toBe("casa-nueva");
    expect(saved[0]!.files.map((f) => f.path)).toEqual(["brand-guidelines.pdf", "photos/terrace.jpg"]);
    expect(ingested).toEqual(["casa-nueva"]);
  });

  it("refuses a brand id that is not a slug, without saving", async () => {
    const { app: a, saved } = uploadApp();
    for (const id of ["", "Casa Brisa", "../escape"]) {
      const res = await a.request("/v1/brands/ingest/upload", upload(id, [pdf()]));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "invalid_brand_id" });
    }
    expect(saved).toEqual([]);
  });

  it("reports why a drop was rejected, without saving", async () => {
    const { app: a, saved, ingested } = uploadApp();
    const res = await a.request("/v1/brands/ingest/upload", upload("casa-nueva", [["notes.docx", new Uint8Array(2)]]));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "unsupported_files", detail: "notes.docx" });
    expect(saved).toEqual([]);
    expect(ingested).toEqual([]);
  });
});
