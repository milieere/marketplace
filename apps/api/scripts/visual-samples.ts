import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Artifact } from "@marketplace/contracts/artifact";
import type { Intent } from "@marketplace/contracts/intent";
import { createFalVisualGenerator } from "../src/adapters/fal/nano-banana-visual-generator";
import { createJsonBrandRepository } from "../src/adapters/fs/json-brand-repository";
import { rankPhotos } from "../src/domain/photo";
import { cardCurrency, pickLogo, preferredOrientation } from "../src/templates/card";

// One generated card per brand, so the whole roster can be judged side by side
// before anything runs through the agent. Costs one fal image per brand.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const out = `${root}out/visuals`;
const only = process.argv.slice(2);

const apiKey = process.env.FAL_API_KEY;
if (!apiKey) throw new Error("FAL_API_KEY is required");

const repo = await createJsonBrandRepository(`${root}data`);
const visuals = createFalVisualGenerator({
  apiKey,
  mode: "full-card",
  ...(process.env.FAL_MODEL ? { model: process.env.FAL_MODEL } : {}),
  ...(process.env.FAL_RESOLUTION ? { resolution: process.env.FAL_RESOLUTION as "1K" | "2K" | "4K" } : {}),
});
await mkdir(out, { recursive: true });

// full-card mode never reads the intent, but the port takes one
const SAMPLE_INTENT: Intent = {
  id: "sample",
  raw: { text: "", inputs: [] },
  scope: "in-domain",
  language: "es",
  phrases: [],
  needs: [],
  assumed: [],
  dropped: [],
  missing: [],
};

const records = (await repo.listVerified()).filter((r) => !only.length || only.includes(r.brand.id));
const cards: string[] = [];

for (const record of records) {
  const location = record.locations[0];
  const offering = record.offerings[0]!;
  const kit = record.brandKit;
  const photo = rankPhotos(kit.photos, { size: 2 }, [], location, preferredOrientation(kit))[0];
  const photoSrc = photo && (await repo.asset(photo.url));
  const declared = pickLogo(kit);
  const logoSrc = declared && (await repo.asset(declared.url.replace(/\.svg$/, ".png")));
  const priceLines = [{ offeringId: offering.id, label: offering.name, amount: offering.price.amount, unit: offering.price.unit, from: offering.price.from ?? false }];

  const artifact = {
    id: `sample-${record.brand.id}`,
    intentId: "sample",
    needIds: ["n1"],
    brandId: record.brand.id,
    locationId: location?.id,
    offeringIds: [offering.id],
    language: record.brand.languages[0] ?? "es",
    format: "card",
    tone: { formality: kit.voice.toneRange.formality[0], energy: kit.voice.toneRange.energy[1] },
    slots: {
      headline: kit.voice.samples[0] ?? record.brand.name,
      subline: offering.name,
      body: record.brand.summary,
      badges: Object.values(location?.attributes ?? {}).flat().slice(0, 2),
      cta: { label: "Reservar", url: location?.reserveUrl ?? "#" },
    },
    priceLines,
    photoId: photo?.id,
    presentation: {
      brand: { id: record.brand.id, name: record.brand.name, summary: record.brand.summary },
      kit: { colors: kit.colors, typography: kit.typography, logos: kit.logos, style: kit.style, voice: kit.voice, imagery: kit.imagery },
      photo: photo && photoSrc ? { id: photo.id, src: photoSrc, alt: photo.description, orientation: photo.orientation } : undefined,
      logo: logoSrc ? { src: logoSrc } : undefined,
    },
    trace: [],
    check: { passed: true, issues: [] },
    relaxed: [],
    htmlUrl: "",
    createdAt: new Date().toISOString(),
  } satisfies Artifact;

  const currency = cardCurrency(record, priceLines);
  try {
    const visual = await visuals.generate({ artifact, record, intent: SAMPLE_INTENT });
    await writeFile(`${out}/${record.brand.id}.prompt.txt`, visual.prompt);
    cards.push(`<figure><img src="${visual.imageUrl}" alt="${record.brand.name}"><figcaption>${record.brand.name} · ${kit.style.composition} · ${currency}</figcaption></figure>`);
    console.log(`ok   ${record.brand.id}  ${visual.imageUrl}`);
  } catch (err) {
    cards.push(`<figure class="failed"><figcaption>${record.brand.name} — ${err instanceof Error ? err.message : "failed"}</figcaption></figure>`);
    console.error(`FAIL ${record.brand.id}  ${err instanceof Error ? err.message : err}`);
  }
}

await writeFile(
  `${out}/index.html`,
  `<!doctype html><meta charset="utf-8"><title>Generated cards</title><style>body{margin:0;padding:20px;background:#15171a;color:#e8e6e3;font:14px system-ui;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px}figure{margin:0}img{width:100%;display:block;border-radius:12px}figcaption{padding-top:8px;opacity:.7}.failed{padding:40px;border:1px dashed #555;border-radius:12px}</style>${cards.join("")}`,
);
console.log(`\n${records.length} brands -> ${out}/index.html`);
