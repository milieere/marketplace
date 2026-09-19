import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createJsonBrandRepository } from "../src/adapters/fs/json-brand-repository";
import { rankPhotos } from "../src/domain/photo";
import { renderCard } from "../src/templates/card";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const out = `${root}out/samples`;
const repo = await createJsonBrandRepository(`${root}data`);
await mkdir(out, { recursive: true });

const links: string[] = [];
for (const record of await repo.listVerified()) {
  const location = record.locations[0];
  const offering = record.offerings[0]!;
  const photo = rankPhotos(record.brandKit.photos, { size: 2 }, [], location)[0];
  const src = photo && (await repo.photo(photo.url));
  const { html } = renderCard({
    record,
    language: "en",
    currency: offering.price.currency,
    slots: {
      headline: record.brandKit.voice.samples[0] ?? record.brand.name,
      subline: `${offering.name} · ${location?.name ?? ""}`,
      body: record.brand.summary,
      badges: Object.values(location?.attributes ?? {}).flat().slice(0, 3),
      cta: { label: "Reserve for 2", url: location?.reserveUrl ?? "#" },
    },
    priceLines: record.offerings.slice(0, 2).map((o) => ({ offeringId: o.id, label: o.name, amount: o.price.amount, unit: o.price.unit, from: o.price.from ?? false })),
    photo: src ? { src, alt: photo.description } : undefined,
  });
  await writeFile(`${out}/${record.brand.id}.html`, html);
  links.push(`<iframe src="${record.brand.id}.html" title="${record.brand.name}"></iframe>`);
}
await writeFile(
  `${out}/index.html`,
  `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#ddd;display:grid;grid-template-columns:repeat(auto-fill,minmax(440px,1fr));gap:16px}iframe{width:100%;height:760px;border:0;background:#fff}</style>${links.join("")}`,
);
console.log(`wrote ${links.length} samples to ${out}/index.html`);
