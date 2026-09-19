import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { AgentEvent } from "@marketplace/contracts/events";
import { createJsonBrandRepository } from "../src/adapters/fs/json-brand-repository";

const API = process.env.API_URL ?? "http://localhost:8787";
// Pinned so "tonight" is the Friday the coverage matrix assumes.
const NOW = process.env.E2E_NOW ?? "2026-09-18T17:00:00+02:00";
const root = fileURLToPath(new URL("../../../", import.meta.url));

type Case = { id: string; text: string; expect: { brands?: string[]; notBrands?: string[]; noMatch?: "no-results" | "out-of-domain"; relaxed?: string } };
const CASES: Case[] = [
  { id: "q1", text: "Friday, 8 friends, two vegans, one celiac, terrace, ~€30 each", expect: { brands: ["casa-brisa", "verde"] } },
  { id: "q2", text: "Estoy con mi pareja, tres horas libres, 50 €, esta noche", expect: { notBrands: ["hotel-albada"] } },
  { id: "q3", text: "Romantic weekend for two, hotel and a nice dinner, €400", expect: { brands: ["hotel-albada"] } },
  { id: "q4", text: "Dinner and then drinks with a view, 4 of us, €60 each", expect: { brands: ["terrat"] } },
  { id: "q5", text: "Sunday brunch, two adults, two kids, grandma uses a wheelchair", expect: { brands: ["cafe-lumen", "hotel-albada"] } },
  { id: "q6", text: "Watch the Barça game tonight, 6 friends, beer and tapas", expect: { brands: ["el-marcador"] } },
  { id: "q7", text: "Quiet café with wifi and plugs, tomorrow morning, 3 hours", expect: { brands: ["cafe-lumen"] } },
  { id: "q8", text: "Mum's 60th, 12 people, she loves seafood, private room, Saturday lunch", expect: { brands: ["grupo-mar"] } },
  { id: "q9", text: "Ramen for two tonight, on a terrace", expect: { brands: ["nami-ramen"], relaxed: "amenities:terrace" } },
  { id: "q10", text: "Vegan dinner for 25 people under €10 each", expect: { noMatch: "no-results" } },
  { id: "q11", text: "My car is making a weird noise", expect: { noMatch: "out-of-domain" } },
  { id: "q12", text: "Something fun tonight", expect: {} },
];

function parseSse(body: string): AgentEvent[] {
  return body
    .split("\n\n")
    .map((block) => block.split("\n").find((line) => line.startsWith("data:")))
    .filter((line): line is string => Boolean(line))
    .map((line) => AgentEvent.parse(JSON.parse(line.slice("data:".length))));
}

const repo = await createJsonBrandRepository(`${root}data`);
const only = process.argv.slice(2);
const cases = only.length ? CASES.filter((c) => only.includes(c.id)) : CASES;
const outDir = `${root}out/e2e`;
await mkdir(outDir, { recursive: true });

let failed = 0;
const frames: string[] = [];
for (const c of cases) {
  const started = Date.now();
  const problems: string[] = [];
  let events: AgentEvent[] = [];
  try {
    const res = await fetch(`${API}/v1/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: c.text, now: NOW }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    events = parseSse(await res.text());
  } catch (err) {
    problems.push(err instanceof Error ? err.message : String(err));
  }
  const seconds = (Date.now() - started) / 1000;

  const matches = events.flatMap((e) => (e.type === "matches" ? e.brands.map((b) => b.id) : []));
  const artifacts = events.flatMap((e) => (e.type === "artifact" ? [e] : []));
  const noMatch = events.find((e) => e.type === "no-match");
  if (events.at(-1)?.type !== "done") problems.push("stream did not end with done");
  for (const e of events) if (e.type === "error") problems.push(`error event: ${e.message}`);
  for (const b of c.expect.brands ?? []) if (!matches.includes(b)) problems.push(`expected ${b} in matches`);
  for (const b of c.expect.notBrands ?? []) if (matches.includes(b)) problems.push(`did not expect ${b}`);
  if (c.expect.noMatch && (noMatch?.type !== "no-match" || noMatch.noMatch.reason !== c.expect.noMatch)) problems.push(`expected no-match ${c.expect.noMatch}`);
  if (!c.expect.noMatch && !artifacts.length) problems.push("no artifacts");
  if (c.expect.relaxed && !events.some((e) => e.type === "relaxed" && e.relaxations.some((r) => r.constraint === c.expect.relaxed))) {
    problems.push(`expected relaxation ${c.expect.relaxed}`);
  }
  if (seconds > 30) problems.push(`took ${seconds.toFixed(1)}s (> 30s)`);

  await mkdir(`${outDir}/${c.id}`, { recursive: true });
  for (const { artifact, html } of artifacts) {
    const record = await repo.get(artifact.brandId);
    for (const line of artifact.priceLines) {
      const offering = record?.offerings.find((o) => o.id === line.offeringId);
      if (!offering || offering.price.amount !== line.amount) problems.push(`${artifact.brandId}: price for ${line.offeringId} differs from data`);
    }
    if (!artifact.check.passed) problems.push(`${artifact.brandId}: brand check failed (${artifact.check.issues.map((i) => i.ruleId).join(", ")})`);
    const share = await fetch(`${API}${artifact.htmlUrl}`);
    if (share.status !== 200) problems.push(`${artifact.brandId}: share link ${share.status}`);
    await writeFile(`${outDir}/${c.id}/${artifact.brandId}.html`, html);
    frames.push(`<figure><figcaption>${c.id} · ${artifact.brandId} — ${c.text.replace(/</g, "&lt;")}</figcaption><iframe src="${c.id}/${artifact.brandId}.html"></iframe></figure>`);
  }
  if (noMatch?.type === "no-match") {
    await writeFile(`${outDir}/${c.id}/no-match.html`, noMatch.noMatch.html);
    frames.push(`<figure><figcaption>${c.id} · no-match — ${c.text.replace(/</g, "&lt;")}</figcaption><iframe src="${c.id}/no-match.html"></iframe></figure>`);
  }
  await writeFile(`${outDir}/${c.id}/events.json`, JSON.stringify(events.map((e) => (e.type === "artifact" ? { ...e, html: "…" } : e.type === "no-match" ? { ...e, noMatch: { ...e.noMatch, html: "…" } } : e)), null, 2));

  const intent = events.find((e) => e.type === "intent");
  const summary = [
    `${seconds.toFixed(1)}s`,
    `matches: ${matches.join(", ") || "—"}`,
    intent?.type === "intent" && intent.intent.dropped.length ? `dropped: ${intent.intent.dropped.join(", ")}` : "",
  ].filter(Boolean);
  console.log(`${problems.length ? "FAIL" : "ok  "} ${c.id.padEnd(4)} ${summary.join(" · ")}`);
  for (const p of problems) console.log(`       - ${p}`);
  if (problems.length) failed++;
}

await writeFile(
  `${outDir}/index.html`,
  `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#ddd;font:13px system-ui;display:grid;grid-template-columns:repeat(auto-fill,minmax(440px,1fr));gap:16px}figure{margin:0}iframe{width:100%;height:760px;border:0;background:#fff}</style>${frames.join("")}`,
);
console.log(`\n${cases.length - failed}/${cases.length} passed · cards in ${outDir}/index.html`);
process.exit(failed ? 1 : 0);
