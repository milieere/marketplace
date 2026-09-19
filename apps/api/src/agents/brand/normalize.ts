import type { BrandKit, Location, Weekday } from "@marketplace/contracts/brand-record";
import type { Attributes, Vocabulary } from "@marketplace/contracts/vocabulary";
import { cmykToHex, contrast, rgbToHex } from "../../domain/color";

type Target = "location" | "offering" | "photo";

// WCAG AA large text: pairs serve headlines and CTAs
const PAIR_CONTRAST = 3;

const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const FALLBACKS: Record<string, string> = {
  serif: "Georgia, serif",
  "sans-serif": "system-ui, sans-serif",
  monospace: "ui-monospace, monospace",
  display: "system-ui, sans-serif",
  script: "cursive",
};

// Offer-sheet wording; vocabulary has no synonym field yet
const SYNONYMS: Record<string, [key: string, value: string]> = {
  v: ["dietary", "vegetarian"],
  vg: ["dietary", "vegan"],
  gf: ["dietary", "gluten-free"],
  "gluten free": ["dietary", "gluten-free"],
  groups: ["occasion", "group"],
  birthdays: ["occasion", "celebration"],
  birthday: ["occasion", "celebration"],
  "date night": ["occasion", "date-night"],
  "after-work": ["occasion", "work"],
  "after work": ["occasion", "work"],
  "private back room": ["amenities", "private-room"],
  "private room": ["amenities", "private-room"],
  "step-free entrance": ["accessibility", "step-free"],
  "wheelchair accessible": ["accessibility", "wheelchair"],
};

export function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Tolerates PDF line breaks, letter-spacing and dash/quote variants
function comparable(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, "");
}

export function grounded(pageText: string, quote: string): boolean {
  const q = comparable(quote);
  return q.length > 0 && comparable(pageText).includes(q);
}

// Models shorten venue names ("Bodega Pinyol" for "Bodega Pinyol Gràcia")
export function sameVenue(venue: string, location: Pick<Location, "id" | "name">): boolean {
  const [a, b] = [slug(venue), slug(location.name)];
  return venue === location.id || a.startsWith(b) || b.startsWith(a);
}

export function pairsWith(colors: Omit<BrandKit["colors"][number], "pairsWith">[]): BrandKit["colors"] {
  return colors.map((c) => ({
    ...c,
    pairsWith: colors.filter((o) => o.id !== c.id && contrast(c.hex, o.hex) >= PAIR_CONTRAST).map((o) => o.id),
  }));
}

export function fontFallback(category: string): string {
  return FALLBACKS[category] ?? FALLBACKS["sans-serif"]!;
}

// Exact, singular, then synonyms; the rest goes to review
export function mapTerms(terms: string[], target: Target, vocabulary: Vocabulary, onlyKey?: string) {
  const attributes: Attributes = {};
  const leftovers: string[] = [];
  const defs = vocabulary.attributes.filter((a) => a.appliesTo.includes(target) && (!onlyKey || a.key === onlyKey));
  for (const raw of terms) {
    const term = raw.trim().toLowerCase();
    if (!term) continue;
    const candidates = [term, term.replace(/s$/, ""), term.replace(/\s+/g, "-")];
    const def = defs.find((d) => candidates.some((c) => d.values.includes(c)));
    const synonym = SYNONYMS[term];
    const hit = def
      ? ([def.key, candidates.find((c) => def.values.includes(c))!] as const)
      : synonym && defs.some((d) => d.key === synonym[0])
        ? synonym
        : undefined;
    if (!hit) leftovers.push(raw.trim());
    else if (!attributes[hit[0]]?.includes(hit[1])) (attributes[hit[0]] ??= []).push(hit[1]);
  }
  return { attributes, leftovers };
}

export function mapAttributes(raw: Record<string, string[]>, target: Target, vocabulary: Vocabulary) {
  const attributes: Attributes = {};
  const leftovers: string[] = [];
  for (const [key, values] of Object.entries(raw)) {
    const known = vocabulary.attributes.some((a) => a.key === key && a.appliesTo.includes(target));
    const mapped = mapTerms(values, target, vocabulary, known ? key : undefined);
    leftovers.push(...mapped.leftovers.map((v) => `${key}: ${v}`));
    for (const [k, vs] of Object.entries(mapped.attributes)) attributes[k] = [...new Set([...(attributes[k] ?? []), ...vs])];
  }
  return { attributes, leftovers };
}

function weekday(word: string): Weekday | undefined {
  return WEEKDAYS.find((d) => word.toLowerCase().startsWith(d));
}

// "tue-sat", "tue,wed,thu", "Tuesday–Thursday"
export function parseDays(text: string): Weekday[] | undefined {
  const parts = text.split(/\s*,\s*/).filter(Boolean);
  const days: Weekday[] = [];
  for (const part of parts) {
    const [from, to] = part.split(/\s*[-\u2013\u2014]\s*/).map(weekday);
    if (!from) return undefined;
    if (!to) days.push(from);
    else {
      const start = WEEKDAYS.indexOf(from);
      const end = WEEKDAYS.indexOf(to);
      for (let i = start; ; i = (i + 1) % 7) {
        days.push(WEEKDAYS[i]!);
        if (i === end) break;
      }
    }
  }
  return days.length ? [...new Set(days)] : undefined;
}

function time(text: string): string {
  const [h, m] = text.split(/[:.]/);
  return `${h!.padStart(2, "0")}:${m}`;
}

// e.g. "Friday–Saturday 13:00–01:00"; closed days stay absent
export function parseOpeningHours(lines: string[]) {
  const hours: Location["openingHours"] = {};
  const unparsed: string[] = [];
  for (const line of lines) {
    if (/closed|cerrado|tancat/i.test(line)) continue;
    const match = line.match(/^\s*([A-Za-z]+(?:\s*[-\u2013\u2014,]\s*[A-Za-z]+)*)\s*:?\s+(.+)$/);
    const days = match && parseDays(match[1]!);
    const ranges = match ? [...match[2]!.matchAll(/(\d{1,2}[:.]\d{2})\s*[-\u2013\u2014]\s*(\d{1,2}[:.]\d{2})/g)] : [];
    if (!days || !ranges.length) {
      unparsed.push(line);
      continue;
    }
    for (const d of days) hours[d] = [...(hours[d] ?? []), ...ranges.map(([, from, to]) => ({ from: time(from!), to: time(to!) }))];
  }
  return { hours, unparsed };
}

// RFC 4180 subset: quoted fields with commas and doubled quotes
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") row.push(field), (field = "");
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field), rows.push(row), (row = []), (field = "");
    } else field += ch;
  }
  if (field || row.length) row.push(field), rows.push(row);
  const [header, ...body] = rows.filter((r) => r.some((f) => f.trim()));
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

type Color = BrandKit["colors"][number];
export type ColorSource = { id: string; name?: string; role?: Color["role"]; hex?: string; rgb?: [number, number, number]; cmyk?: [number, number, number, number] };

// Tokens win; PDF text values next; CMYK converted only as a last resort
export function mergeColors(tokens: ColorSource[], pdf: ColorSource[]) {
  const colors: Omit<Color, "pairsWith">[] = [];
  const converted: { id: string; hex: string; cmyk: number[] }[] = [];
  const notes: string[] = [];
  for (const id of new Set([...tokens, ...pdf].map((c) => c.id))) {
    const t = tokens.find((c) => c.id === id);
    const p = pdf.find((c) => c.id === id);
    const name = p?.name ?? id;
    const printed = p?.hex ?? (p?.rgb && rgbToHex(p.rgb));
    const fromCmyk = !t?.hex && !printed && p?.cmyk ? cmykToHex(p.cmyk) : undefined;
    const hex = t?.hex ?? printed ?? fromCmyk;
    const role = t?.role ?? p?.role;
    if (!hex || !role) {
      notes.push(`Colour '${name}': no ${hex ? "role" : "usable value"} found; left out.`);
      continue;
    }
    if (t?.hex && printed && t.hex !== printed) notes.push(`Colour '${name}': design tokens say ${t.hex}, the guidelines say ${printed}; kept the tokens.`);
    if (fromCmyk) {
      converted.push({ id, hex: fromCmyk, cmyk: p!.cmyk! });
      notes.push(`Colour '${name}' was only given in CMYK (${p!.cmyk!.join(" ")}); converted to ${fromCmyk}. Please confirm.`);
    }
    colors.push({ id, hex, role });
  }
  return { colors: pairsWith(colors), converted, notes };
}

export function mergeFonts(tokens: BrandKit["typography"], pdf: BrandKit["typography"]): BrandKit["typography"] {
  return [...tokens, ...pdf.filter((f) => !tokens.some((t) => t.role === f.role))];
}
