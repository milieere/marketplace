import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { AgentEvent } from "@marketplace/contracts/events";

// Same brand, four requests; the contrast is the pitch
const API = process.env.API_URL ?? "http://localhost:8787";
const BRAND = process.env.PITCH_BRAND ?? "casa-brisa";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const out = `${root}out/pitch`;

const FRIDAY = "2026-09-18T17:00:00+02:00";
const WEDNESDAY = "2026-09-16T15:00:00+02:00";

type Case = { id: string; label: string; text: string; now: string; expectOffering: string };

const CASES: Case[] = [
  {
    id: "1-friends",
    label: "A lively table of friends",
    text: "Friday, 8 friends, two vegans, one celiac, terrace, ~€30 each",
    now: FRIDAY,
    expectOffering: "cb-sharing-menu",
  },
  {
    id: "2-anniversary",
    label: "An intimate anniversary",
    text: "Our anniversary, just the two of us, somewhere romantic tonight",
    now: FRIDAY,
    expectOffering: "cb-tasting-for-two",
  },
  {
    id: "3-after-work",
    label: "A quick drink after work",
    text: "Quick vermouth with three colleagues after work today, around 7, nothing fancy",
    now: WEDNESDAY,
    expectOffering: "cb-vermut-hour",
  },
  {
    id: "4-celebration",
    label: "A family celebration",
    text: "My mother's 60th, 14 of us, Saturday lunch, we would like a private room",
    now: FRIDAY,
    expectOffering: "cb-private-room",
  },
];

function parseSse(body: string): AgentEvent[] {
  return body
    .split("\n\n")
    .map((block) => block.split("\n").find((line) => line.startsWith("data:")))
    .filter((line): line is string => Boolean(line))
    .map((line) => AgentEvent.parse(JSON.parse(line.slice(5).trim())));
}

type Result = Case & {
  imageUrl?: string;
  headline?: string;
  offeringIds?: string[];
  priceLine?: string;
  photoId?: string;
  tone?: { formality: number; energy: number };
  note?: string;
};

await mkdir(out, { recursive: true });
const results: Result[] = [];

for (const testCase of CASES) {
  const response = await fetch(`${API}/v1/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: testCase.text, format: "card", now: testCase.now }),
  });
  const events = parseSse(await response.text());

  const artifact = events.flatMap((e) => (e.type === "artifact" && e.artifact.brandId === BRAND ? [e.artifact] : []))[0];
  if (!artifact) {
    const brands = [...new Set(events.flatMap((e) => (e.type === "artifact" ? [e.artifact.brandId] : [])))];
    results.push({ ...testCase, note: `${BRAND} did not match. Got: ${brands.join(", ") || "nothing"}` });
    console.log(`MISS ${testCase.id}  ${BRAND} not matched (got ${brands.join(", ") || "nothing"})`);
    continue;
  }

  const visual = events.flatMap((e) => (e.type === "visual" && e.artifactId === artifact.id ? [e] : []))[0];
  const line = artifact.priceLines[0];
  const result: Result = {
    ...testCase,
    imageUrl: visual?.imageUrl,
    headline: artifact.slots.headline,
    offeringIds: artifact.offeringIds,
    priceLine: line && `${line.label} — ${line.from ? "from " : ""}${line.amount} / ${line.unit}`,
    photoId: artifact.photoId,
    tone: artifact.tone,
    note: visual ? undefined : "visual failed",
  };
  results.push(result);
  if (visual) await writeFile(`${out}/${testCase.id}.prompt.txt`, visual.prompt ?? "");

  const hit = artifact.offeringIds.includes(testCase.expectOffering) ? "ok  " : "diff";
  console.log(`${hit} ${testCase.id}  offer=${artifact.offeringIds.join(",")} photo=${artifact.photoId} tone=${artifact.tone.energy.toFixed(2)}/${artifact.tone.formality.toFixed(2)}`);
  console.log(`     "${artifact.slots.headline}"`);
}

const cards = results
  .map(
    (r) => `<figure>
  <div class="q">${r.text}</div>
  ${r.imageUrl ? `<img src="${r.imageUrl}" alt="${r.label}">` : `<div class="missing">${r.note ?? "no image"}</div>`}
  <figcaption>
    <strong>${r.label}</strong>
    <span>${r.offeringIds?.join(", ") ?? "—"}</span>
    <span>${r.priceLine ?? "—"}</span>
    <span>photo: ${r.photoId ?? "—"}</span>
    <span>tone: energy ${r.tone?.energy.toFixed(2) ?? "—"} · formality ${r.tone?.formality.toFixed(2) ?? "—"}</span>
  </figcaption>
</figure>`,
  )
  .join("");

await writeFile(
  `${out}/index.html`,
  `<!doctype html><meta charset="utf-8"><title>${BRAND} — one brand, four requests</title><style>
body{margin:0;padding:28px;background:#0f1115;color:#e8e6e3;font:14px/1.5 system-ui}
h1{font-size:20px;font-weight:600;margin:0 0 6px}
p.lede{margin:0 0 24px;opacity:.65;max-width:70ch}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:24px}
figure{margin:0;display:flex;flex-direction:column;gap:10px}
.q{font-style:italic;opacity:.8;min-height:3em}
img{width:100%;display:block;border-radius:12px}
.missing{aspect-ratio:3/4;display:grid;place-items:center;border:1px dashed #444;border-radius:12px;opacity:.6;text-align:center;padding:16px}
figcaption{display:flex;flex-direction:column;gap:2px;font-size:12px;opacity:.7}
figcaption strong{font-size:14px;opacity:1}
</style>
<h1>${BRAND} — one brand, four requests</h1>
<p class="lede">Same palette, same typefaces, same mark, same layout rules — every one rendered from the brand kit. What changes is the offer, the photograph, the copy and the tone, and all of that comes from the request.</p>
<div class="grid">${cards}</div>`,
);

const made = results.filter((r) => r.imageUrl).length;
console.log(`\n${made}/${CASES.length} cards -> ${out}/index.html`);
