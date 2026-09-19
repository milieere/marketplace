import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentEvent } from "@marketplace/contracts/events";
import { describe, expect, it } from "vitest";
import { createFsSourcePacks } from "../../../src/adapters/fs/source-packs";
import { createPdfReader } from "../../../src/adapters/pdf/unpdf-reader";
import { createBrandAgent } from "../../../src/agents/brand/brand-agent";
import { loadConfig } from "../../../src/config";
import { checkBrandRecord } from "../../../src/domain/brand-integrity";
import { createApp } from "../../../src/http/app";
import type { Llm } from "../../../src/ports/llm";
import { DATA_DIR, loadRepository, parseSse } from "../../support";

const DOC = "doc-brand-guidelines";
const cite = (page: number, quote: string, confidence = 0.9) => ({ document: DOC, page, quote, confidence });

// Quotes copied from the real PDF so grounding passes
const ANSWERS: Record<string, unknown> = {
  route: {
    pages: [
      { document: DOC, page: 1, topics: ["identity", "voice"] },
      { document: DOC, page: 2, topics: ["identity"] },
      { document: DOC, page: 3, topics: ["logo", "rules"] },
      { document: DOC, page: 4, topics: ["color", "rules"] },
      { document: DOC, page: 5, topics: ["typography", "rules"] },
      { document: DOC, page: 6, topics: ["voice", "rules"] },
      { document: DOC, page: 7, topics: ["imagery"] },
      { document: DOC, page: 8, topics: ["location"] },
    ],
  },
  "extract:identity": {
    name: "Casa Brisa",
    summary: "Mediterranean tapas bar in Barcelona built around sharing plates and long terrace evenings.",
    languages: ["es", "ca", "en"],
    website: "https://casabrisa.example",
    style: { radius: 16, density: "airy", headlineCase: "sentence", imageTreatment: "full-bleed", composition: "text-over-image", ornament: "rule" },
    imagery: { style: "Warm golden-hour light, overhead shots of shared tables, natural textures, candid people", avoid: ["flash photography", "empty rooms", "close-ups of hands eating"] },
    cite: {
      name: cite(1, "Casa Brisa"),
      summary: cite(2, "Casa Brisa is a Mediterranean tapas bar in Barcelona built around sharing plates and long terrace evenings."),
      languages: cite(2, "We welcome guests in Spanish, Catalan and English."),
      style: cite(5, "Layouts are airy: generous white space, rounded corners (16 px radius)", 0.8),
      imagery: cite(7, "Warm golden-hour light, overhead shots of shared tables"),
    },
  },
  "extract:colors": {
    colors: [
      { name: "Terracotta", role: "primary", hex: "#C8553D", rgb: [200, 85, 61], cmyk: [0, 58, 70, 22], cite: cite(4, "HEX #C8553D") },
      // Model-converted hex, not printed: code must ignore it
      { name: "Olive", role: "secondary", hex: "#5A6B3A", rgb: null, cmyk: [15, 0, 46, 58], cite: cite(4, "CMYK 15 0 46 58") },
      { name: "Saffron", role: "accent", hex: "#F2A541", rgb: null, cmyk: null, cite: cite(4, "HEX #F2A541") },
      { name: "Sand", role: "background", hex: "#F6EFE6", rgb: null, cmyk: null, cite: cite(4, "HEX #F6EFE6") },
      { name: "Ink", role: "text", hex: "#2B2118", rgb: null, cmyk: null, cite: cite(4, "HEX #2B2118") },
    ],
  },
  "extract:typography": {
    fonts: [
      { role: "display", family: "Fraunces", weights: [600, 800], category: "serif", cite: cite(5, "Display and headlines: Fraunces") },
      { role: "body", family: "Inter", weights: [400, 600], category: "sans-serif", cite: cite(5, "Body: Inter") },
    ],
  },
  "extract:voice": {
    summary: "Warm, generous, Mediterranean. Talks like a host, never like an ad.",
    formality: [0.6, 0.2],
    energy: [0.3, 0.8],
    doSay: ["share", "table", "together", "slow evenings"],
    dontSay: ["cheap", "deal", "hurry", "limited time"],
    samples: ["Pull up a chair. The terrace is yours tonight.", "Small plates, big conversations.", "Made to share, meant to linger.", "Tapas you'll never forget."],
    cite: {
      summary: cite(6, "We talk like a host, never like an ad."),
      toneRange: cite(6, "more friendly than formal, lively without shouting", 0.6),
      doSay: cite(6, "share · table · together · slow evenings"),
      dontSay: cite(6, "cheap · deal · hurry · limited time"),
      samples: cite(6, "Pull up a chair. The terrace is yours tonight."),
    },
  },
  "extract:rules": {
    rules: [
      { text: "Headlines are at most 60 characters.", severity: "block", check: { kind: "max-length", slot: "headline", max: 60 }, cite: cite(5, "Headlines are set in sentence case and are at most 60 characters.") },
      { text: "Never frame an offer as cheap or discounted.", severity: "block", check: { kind: "forbidden-term", terms: ["cheap", "discount", "deal"] }, cite: cite(6, "Never frame an offer as cheap or discounted.") },
      { text: "Text must reach at least 4.5:1 contrast.", severity: "block", check: { kind: "min-contrast", ratio: 4.5 }, cite: cite(4, "Text must reach at least 4.5:1 contrast against its background.") },
      { text: "Never place the logo directly on photos.", severity: "block", check: null, cite: cite(3, "Never place the logo directly on photos.") },
    ],
  },
  "extract:locations": {
    locations: [
      {
        name: "Casa Brisa El Born",
        address: "Carrer de l'Argenteria 12, 08003 Barcelona",
        timezone: "Europe/Madrid",
        hours: ["Monday closed", "Tuesday–Thursday 18:00–00:00", "Friday–Saturday 13:00–01:00", "Sunday 13:00–17:00", "Holidays 10:00–14:00"],
        attributes: { cuisine: ["tapas", "Mediterranean"], amenities: ["terrace", "private back room"], accessibility: ["step-free", "wheelchair"], ambience: ["lively", "romantic"] },
        reserveUrl: "https://casabrisa.example/reserve?venue=born",
        lat: 41.3839,
        lng: 2.1817,
        priceLevel: "€€",
        cite: {
          address: cite(8, "Carrer de l'Argenteria 12, 08003 Barcelona"),
          hours: cite(8, "Tuesday–Thursday 18:00–00:00"),
          attributes: cite(8, "A sunny terrace on the square and a private back room for celebrations."),
        },
      },
    ],
  },
  "tag-photo:terrace-group": { description: "Group of friends sharing tapas on a sunny terrace", attributes: { people: ["group"], amenities: ["terrace"], ambience: ["lively"], occasion: ["group", "celebration"] }, confidence: 0.85 },
  "tag-photo:candle-couple": { description: "Couple at a candle-lit table", attributes: { people: ["couple"], ambience: ["romantic", "cosy"], occasion: ["date-night"] }, confidence: 0.85 },
  "tag-photo:table-overhead": { description: "Overhead shot of small plates", attributes: { people: ["none"], occasion: ["group"] }, confidence: 0.8 },
  "tag-photo:vermut-bar": { description: "Vermouth glasses on the bar", attributes: { people: ["none"], occasion: ["work", "group"], mood: ["golden"] }, confidence: 0.8 },
};

function fakeLlm() {
  const steps: string[] = [];
  const llm: Llm = {
    async structured(req) {
      steps.push(req.step);
      if (req.step.startsWith("tag-photo:")) expect(req.images).toHaveLength(1);
      if (req.step === "tag-photo:private-room") throw new Error("vision model unavailable");
      if (req.step.startsWith("verify:")) return req.schema.parse({ supported: false, cite: null, note: "the pages only imply it" });
      if (!(req.step in ANSWERS)) throw new Error(`unscripted step ${req.step}`);
      return req.schema.parse(ANSWERS[req.step]);
    },
  };
  return { llm, steps };
}

async function ingest(body: unknown) {
  const { llm, steps } = fakeLlm();
  const brands = await loadRepository();
  const brandAgent = createBrandAgent({
    llm,
    brands,
    sources: createFsSourcePacks(join(DATA_DIR, "sources")),
    reader: createPdfReader(),
    clock: () => new Date("2026-09-19T10:00:00Z"),
  });
  const app = createApp(loadConfig({ NEBIUS_API_KEY: "test" }), { brandAgent });
  const res = await app.request("/v1/brands/ingest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const events = parseSse(await res.text());
  const record = events.find((e): e is Extract<AgentEvent, { type: "record" }> => e.type === "record")?.record;
  return { res, events, record, steps, vocabulary: await brands.vocabulary("hospitality") };
}

describe("Brand Agent over HTTP with a scripted LLM", () => {
  it("streams the recorded step order and a valid draft record", async () => {
    const { res, events, record, vocabulary } = await ingest({ brandId: "casa-brisa" });
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const steps = events.flatMap((e) => (e.type === "step" ? [`${e.id}:${e.status}`] : []));
    expect(steps).toEqual([
      "read:started",
      "read:done",
      "route:started",
      "route:done",
      "extract:started",
      "extract:done",
      "normalize:started",
      "normalize:done",
      "verify:started",
      "verify:done",
    ]);
    expect(events.slice(-2).map((e) => e.type)).toEqual(["record", "done"]);
    expect(events.filter((e) => e.type === "finding").length).toBeGreaterThan(20);

    expect(record).toBeDefined();
    expect(record!.status).toBe("draft");
    expect(checkBrandRecord(record!, vocabulary)).toEqual([]);
  });

  it("copies prices and conditions from the offers sheet and links venues", async () => {
    const { record } = await ingest({ brandId: "casa-brisa" });
    const expected = JSON.parse(readFileSync(join(DATA_DIR, "sources", "casa-brisa", "expected.json"), "utf8"));
    for (const o of expected.offerings) {
      const actual = record!.offerings.find((x) => x.id === o.id)!;
      expect(actual.price).toEqual(o.price);
      expect(actual.conditions).toBe(o.conditions);
      expect(actual.partySize).toEqual(o.partySize);
      expect(actual.availability).toEqual(o.availability);
    }
    expect(record!.offerings.find((o) => o.id === "cb-private-room")!.locationIds).toEqual(["casa-brisa-el-born"]);
    expect(record!.offerings.find((o) => o.id === "cb-sharing-menu")!.attributes.dietary).toEqual(["vegetarian", "vegan", "gluten-free"]);
  });

  it("converts the CMYK-only colour in code, ignoring the model's own hex, and flags it", async () => {
    const { events, record } = await ingest({ brandId: "casa-brisa" });
    expect(record!.brandKit.colors.find((c) => c.id === "olive")!.hex).toBe("#5B6B3A");
    expect(record!.reviewNotes).toContain("Colour 'Olive' was only given in CMYK (15 0 46 58); converted to #5B6B3A. Please confirm.");
    const normalizeIndex = events.findIndex((e) => e.type === "step" && e.id === "normalize");
    expect(events.slice(normalizeIndex).find((e) => e.type === "finding")).toMatchObject({ field: "brandKit.colors[olive].hex", value: "#5B6B3A" });
  });

  it("keeps only grounded facts: hours, samples and vocabulary values", async () => {
    const { record } = await ingest({ brandId: "casa-brisa" });
    const location = record!.locations[0]!;
    expect(location.openingHours).toEqual(JSON.parse(readFileSync(join(DATA_DIR, "sources", "casa-brisa", "expected.json"), "utf8")).locations[0].openingHours);
    expect(location.attributes.amenities).toEqual(["terrace", "private-room"]);
    expect(location.priceLevel).toBe(2);
    expect(record!.brandKit.voice.samples).not.toContain("Tapas you'll never forget.");
    expect(record!.brandKit.voice.toneRange.formality).toEqual([0.2, 0.6]);
    expect(record!.reviewNotes.join("\n")).toMatch(/Holidays 10:00–14:00/);
  });

  it("re-asks low-confidence fields once and flags what stays unconfirmed", async () => {
    const { steps, record } = await ingest({ brandId: "casa-brisa" });
    expect(steps.filter((s) => s.startsWith("verify:"))).toEqual(["verify:brandKit.voice.toneRange"]);
    expect(record!.reviewNotes.join("\n")).toMatch(/brandKit\.voice\.toneRange: couldn't confirm/);
  });

  it("keeps an untaggable photo for review instead of failing", async () => {
    const { record } = await ingest({ brandId: "casa-brisa" });
    expect(record!.brandKit.photos.map((p) => p.id)).toEqual(["candle-couple", "private-room", "table-overhead", "terrace-group", "vermut-bar"]);
    expect(record!.brandKit.photos.find((p) => p.id === "private-room")!.attributes).toEqual({});
    expect(record!.brandKit.photos.find((p) => p.id === "candle-couple")!.orientation).toBe("portrait");
    expect(record!.reviewNotes).toContain("Photo private-room couldn't be tagged; please tag it by hand.");
  });

  it("answers with an error event for an unknown pack", async () => {
    const { events } = await ingest({ brandId: "nope" });
    expect(events.map((e) => e.type)).toEqual(["error", "done"]);
  });

  it("rejects an invalid brand id", async () => {
    const { res } = await ingest({ brandId: "../etc" });
    expect(res.status).toBe(400);
  });
});
