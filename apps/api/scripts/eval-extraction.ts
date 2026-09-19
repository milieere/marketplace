import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BrandRecord } from "@marketplace/contracts/brand-record";
import { loadConfig } from "../src/config";
import { createContainer } from "../src/container";

const BRAND = "casa-brisa";
const root = fileURLToPath(new URL("../../../", import.meta.url));
type Json = Record<string, any>;

const expected: Json = JSON.parse(await readFile(`${root}data/sources/${BRAND}/expected.json`, "utf8"));

async function liveRecord(): Promise<BrandRecord> {
  const deps = await createContainer(loadConfig({ ...process.env, MOCK: "0" }));
  if (!deps.brandAgent) throw new Error("No LLM adapter wired in container.ts yet (PR 3). Pass a record file instead.");
  const abort = new AbortController();
  for await (const event of deps.brandAgent.run({ brandId: BRAND }, abort.signal)) {
    if (event.type === "step") console.log(`  ${event.id} ${event.status}${event.detail ? ` · ${event.detail}` : ""}`);
    if (event.type === "error") throw new Error(event.message);
    if (event.type === "record") {
      await mkdir(`${root}out/extraction`, { recursive: true });
      await writeFile(`${root}out/extraction/${BRAND}.json`, JSON.stringify(event.record, null, 2));
      return event.record;
    }
  }
  throw new Error("Brand Agent ended without a record");
}

// Relative to the caller's cwd; no path runs the live agent
const path = process.argv[2] && resolve(process.env.INIT_CWD ?? process.cwd(), process.argv[2]);
const actual: Json = path ? BrandRecord.parse(JSON.parse(await readFile(path, "utf8"))) : await liveRecord();

type Check = { field: string; pass: boolean; critical?: boolean; got?: unknown; want?: unknown };
const checks: Check[] = [];
const norm = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const sameSet = (a: unknown[] = [], b: unknown[] = []) => same([...a.map(norm)].sort(), [...b.map(norm)].sort());
const covers = (got: string[] = [], want: string[] = [], share = 0.5) => want.filter((w) => got.some((g) => norm(g) === norm(w))).length >= Math.ceil(want.length * share);
const check = (field: string, pass: boolean, got?: unknown, want?: unknown, critical = false) => checks.push({ field, pass, got, want, critical });
const sortAttrs = (a: Json = {}) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, [...(v as string[])].sort()]).sort());

check("brand.name", norm(actual.brand.name) === norm(expected.brand.name), actual.brand.name, expected.brand.name);
check("brand.languages", sameSet(actual.brand.languages, expected.brand.languages), actual.brand.languages, expected.brand.languages);
check("brand.website", actual.brand.website === expected.brand.website, actual.brand.website, expected.brand.website);
check("brand.summary", Boolean(actual.brand.summary), actual.brand.summary);

for (const c of expected.brandKit.colors) {
  const a = actual.brandKit.colors.find((x: Json) => x.id === c.id);
  check(`colors[${c.id}].hex`, a?.hex === c.hex, a?.hex, c.hex, true);
  check(`colors[${c.id}].role`, a?.role === c.role, a?.role, c.role);
  check(`colors[${c.id}].pairsWith`, sameSet(a?.pairsWith, c.pairsWith), a?.pairsWith, c.pairsWith);
}
for (const t of expected.brandKit.typography) {
  const a = actual.brandKit.typography.find((x: Json) => x.role === t.role);
  check(`typography[${t.role}].family`, a?.family === t.family, a?.family, t.family);
  check(`typography[${t.role}].weights`, sameSet(a?.weights, t.weights), a?.weights, t.weights);
  check(`typography[${t.role}].fallback`, a?.fallback === t.fallback, a?.fallback, t.fallback);
}
for (const [k, v] of Object.entries(expected.brandKit.style)) check(`style.${k}`, actual.brandKit.style[k] === v, actual.brandKit.style[k], v);

const voice = actual.brandKit.voice;
check("voice.samples", expected.brandKit.voice.samples.every((s: string) => voice.samples.includes(s)), voice.samples, expected.brandKit.voice.samples);
check("voice.doSay", covers(voice.doSay, expected.brandKit.voice.doSay), voice.doSay, expected.brandKit.voice.doSay);
check("voice.dontSay", covers(voice.dontSay, expected.brandKit.voice.dontSay), voice.dontSay, expected.brandKit.voice.dontSay);
for (const axis of ["formality", "energy"] as const) {
  const [lo, hi] = voice.toneRange[axis];
  const [elo, ehi] = expected.brandKit.voice.toneRange[axis];
  check(`voice.toneRange.${axis}`, Math.abs(lo - elo) <= 0.2 && Math.abs(hi - ehi) <= 0.2, [lo, hi], [elo, ehi]);
}
check("imagery.avoid", covers(actual.brandKit.imagery.avoid, expected.brandKit.imagery.avoid), actual.brandKit.imagery.avoid, expected.brandKit.imagery.avoid);

for (const kind of new Set(expected.brandKit.rules.flatMap((r: Json) => (r.check ? [r.check.kind] : [])))) {
  check(`rules[${kind}]`, actual.brandKit.rules.some((r: Json) => r.check?.kind === kind));
}

for (const p of expected.brandKit.photos) {
  const a = actual.brandKit.photos.find((x: Json) => x.id === p.id);
  check(`photos[${p.id}].orientation`, a?.orientation === p.orientation, a?.orientation, p.orientation);
  check(`photos[${p.id}].people`, sameSet(a?.attributes.people, p.attributes.people), a?.attributes.people, p.attributes.people);
}

// Location ids come from the venue name, so locations match by position
const locationIds = new Map<string, string>();
expected.locations.forEach((l: Json, i: number) => {
  const a = actual.locations[i];
  if (a) locationIds.set(l.id, a.id);
  check(`locations[${i}].address`, a?.address === l.address, a?.address, l.address);
  check(`locations[${i}].openingHours`, same(a?.openingHours, l.openingHours), a?.openingHours, l.openingHours, true);
  check(`locations[${i}].timezone`, a?.timezone === l.timezone, a?.timezone, l.timezone);
  check(`locations[${i}].reserveUrl`, a?.reserveUrl === l.reserveUrl, a?.reserveUrl, l.reserveUrl);
  check(`locations[${i}].priceLevel`, a?.priceLevel === l.priceLevel, a?.priceLevel, l.priceLevel);
  check(`locations[${i}].geo`, same(a?.geo, l.geo), a?.geo, l.geo);
  for (const [k, v] of Object.entries(l.attributes)) check(`locations[${i}].attributes.${k}`, sameSet(a?.attributes[k], v as string[]), a?.attributes[k], v);
});

for (const o of expected.offerings) {
  const a = actual.offerings.find((x: Json) => x.id === o.id);
  check(`offerings[${o.id}].price`, same(a?.price, o.price), a?.price, o.price, true);
  check(`offerings[${o.id}].conditions`, a?.conditions === o.conditions, a?.conditions, o.conditions, true);
  check(`offerings[${o.id}].availability`, same(a?.availability, o.availability), a?.availability, o.availability, true);
  check(`offerings[${o.id}].partySize`, same(a?.partySize, o.partySize), a?.partySize, o.partySize);
  check(`offerings[${o.id}].kind`, a?.kind === o.kind, a?.kind, o.kind);
  check(`offerings[${o.id}].attributes`, same(sortAttrs(a?.attributes), sortAttrs(o.attributes)), a?.attributes, o.attributes);
  const wantLocations = (o.locationIds ?? []).map((id: string) => locationIds.get(id) ?? id);
  check(`offerings[${o.id}].locationIds`, sameSet(a?.locationIds, wantLocations), a?.locationIds, wantLocations);
}
for (const extra of actual.offerings.filter((a: Json) => !expected.offerings.some((o: Json) => o.id === a.id))) {
  check(`offerings[${extra.id}] invented`, false, extra.name, undefined, true);
}

const failed = checks.filter((c) => !c.pass);
for (const c of failed) console.log(`${c.critical ? "✗✗" : "✗ "} ${c.field}\n     got  ${JSON.stringify(c.got)}\n     want ${JSON.stringify(c.want)}`);
console.log(`\n${checks.length - failed.length}/${checks.length} fields correct · ${failed.filter((c) => c.critical).length} critical misses (colours, hours, prices, conditions)`);
console.log(`review notes: ${actual.reviewNotes.length}${actual.reviewNotes.map((n: string) => `\n  - ${n}`).join("")}`);
process.exitCode = failed.some((c) => c.critical) ? 1 : 0;
