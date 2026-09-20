import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Artifact } from "@marketplace/contracts/artifact";
import { createJsonBrandRepository } from "../src/adapters/fs/json-brand-repository";
import { createAiSdkLlm } from "../src/adapters/nebius/ai-sdk-llm";
import { createChromeRasterizer } from "../src/adapters/chrome/rasterizer";
import { designCardChecked } from "../src/agents/creative/design";
import { rankPhotos } from "../src/domain/photo";
import { cardCurrency, pickLogo, preferredOrientation } from "../src/templates/card";
import { renderCardShell } from "../src/templates/card-shell";

// Static brand photo stands in for the generated scene, so this costs no image credits
const root = fileURLToPath(new URL("../../../", import.meta.url));
const out = `${root}out/designs`;
const only = process.argv.slice(2);

const llm = createAiSdkLlm({
  apiKey: process.env.NEBIUS_API_KEY!,
  baseURL: process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1",
  models: [process.env.MODEL_TEXT ?? "deepseek-ai/DeepSeek-V4-Pro-0813"],
  visionModels: [process.env.MODEL_VISION ?? "google/gemma-3-27b-it"],
  timeoutMs: 120_000,
});
const rasterizer = createChromeRasterizer();

const repo = await createJsonBrandRepository(`${root}data`);
await mkdir(out, { recursive: true });

const records = (await repo.listVerified()).filter((r) => !only.length || only.includes(r.brand.id));
const frames: string[] = [];

await Promise.all(
  records.map(async (record) => {
    const kit = record.brandKit;
    const location = record.locations[0];
    const offering = record.offerings[0]!;
    const photo = rankPhotos(kit.photos, { size: 2 }, [], location, preferredOrientation(kit))[0];
    const image = photo && (await repo.asset(photo.url));
    const declared = pickLogo(kit);
    const logo = declared && (await repo.asset(declared.url));
    const priceLines = [{ offeringId: offering.id, label: offering.name, amount: offering.price.amount, unit: offering.price.unit, from: offering.price.from ?? false }];
    const slots = {
      headline: kit.voice.samples[0] ?? record.brand.name,
      subline: offering.name,
      body: record.brand.summary,
      badges: Object.values(location?.attributes ?? {}).flat().slice(0, 3),
      cta: { label: "Reservar", url: "#" },
    };
    const artifact = {
      id: `design-${record.brand.id}`,
      language: record.brand.languages[0] ?? "es",
      tone: { formality: kit.voice.toneRange.formality[0], energy: kit.voice.toneRange.energy[1] },
      slots,
      priceLines,
    } as unknown as Artifact;

    const render = (css: string) => renderCardShell({ record, language: artifact.language, slots, priceLines, location, image, logo, css });
    const strings = [slots.headline, slots.subline, slots.body, ...slots.badges, location?.name, priceLines[0] && `${priceLines[0].amount}`].filter(
      (x): x is string => Boolean(x),
    );

    try {
      const design = await designCardChecked(
        { llm, rasterizer, render, strings, size: { width: 480, height: 640 } },
        { record, artifact, location, hasPhoto: Boolean(image), hasLogo: Boolean(logo) },
      );
      await writeFile(`${out}/${record.brand.id}.html`, render(design.css));
      await writeFile(`${out}/${record.brand.id}.css`, design.css);
      const state = design.defects.length ? `STILL BROKEN after ${design.attempts}: ${design.defects.join("; ").slice(0, 70)}` : `clean in ${design.attempts}`;
      console.log(`ok   ${record.brand.id.padEnd(14)} [${state}] ${design.idea.slice(0, 60)}`);
    } catch (err) {
      console.error(`FAIL ${record.brand.id.padEnd(14)} ${err instanceof Error ? err.message.slice(0, 120) : err}`);
    }
    void cardCurrency;
  }),
);

for (const record of records) frames.push(`<figure><iframe src="${record.brand.id}.html" title="${record.brand.name}"></iframe><figcaption>${record.brand.name}</figcaption></figure>`);
await writeFile(
  `${out}/index.html`,
  `<!doctype html><meta charset="utf-8"><title>Designed cards</title><style>
body{margin:0;padding:24px;background:#0f1115;color:#e8e6e3;font:13px system-ui;display:grid;grid-template-columns:repeat(auto-fill,minmax(460px,1fr));gap:24px}
figure{margin:0}iframe{width:100%;height:820px;border:0;border-radius:14px;background:#fff}
figcaption{padding-top:8px;opacity:.6}</style>${frames.join("")}`,
);
console.log(`\n-> ${out}/index.html`);
