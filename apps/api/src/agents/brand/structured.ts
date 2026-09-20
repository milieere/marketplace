import { z } from "zod";
import { BrandKit, Offering, PriceUnit } from "@marketplace/contracts/brand-record";
import type { Vocabulary } from "@marketplace/contracts/vocabulary";
import { fontFallback, mapTerms, parseCsv, parseDays } from "./normalize";
import type { Finding } from "./findings";

type Color = BrandKit["colors"][number];
type Font = BrandKit["typography"][number];

const ColorRole = BrandKit.shape.colors.element.shape.role;
const FontRole = BrandKit.shape.typography.element.shape.role;

const TokensFile = z.object({
  color: z.record(z.string(), z.object({ $value: z.string().regex(/^#[0-9A-Fa-f]{6}$/), role: ColorRole.optional() })).default({}),
  typography: z
    .record(z.string(), z.object({ fontFamily: z.string(), fontWeights: z.array(z.number().int()).default([400]), category: z.string().default("sans-serif") }))
    .default({}),
});

export type TokenColor = { id: string; hex: string; role?: Color["role"] };
export type Tokens = { colors: TokenColor[]; fonts: Font[]; findings: Finding[] };

export function mapTokens(json: unknown, documentId: string): Tokens {
  const tokens = TokensFile.parse(json);
  const findings: Finding[] = [];
  const colors = Object.entries(tokens.color).map(([id, t]) => {
    const hex = t.$value.toUpperCase();
    const field = `brandKit.colors[${id}].hex`;
    findings.push({ field, value: hex, evidence: { field, documentId, quote: `"${id}": ${t.$value}`, confidence: 1 } });
    return { id, hex, role: t.role };
  });
  const fonts = Object.entries(tokens.typography).flatMap(([role, t]) => {
    const parsed = FontRole.safeParse(role);
    return parsed.success ? [{ role: parsed.data, family: t.fontFamily, weights: t.fontWeights, fallback: fontFallback(t.category) }] : [];
  });
  if (fonts.length) {
    findings.push({
      field: "brandKit.typography",
      value: fonts.map((f) => `${f.family} (${f.role})`),
      evidence: { field: "brandKit.typography", documentId, quote: fonts.map((f) => `${f.role}: ${f.family}`).join(", "), confidence: 1 },
    });
  }
  return { colors, fonts, findings };
}

export type OfferRows = { offerings: (Offering & { venue?: string })[]; findings: Finding[]; notes: string[] };

// Prices, conditions and times are copied from the sheet, never inferred
export function mapOffersCsv(text: string, documentId: string, vocabulary: Vocabulary): OfferRows {
  const offerings: OfferRows["offerings"] = [];
  const findings: Finding[] = [];
  const notes: string[] = [];
  const lines = text.split(/\r?\n/);

  for (const row of parseCsv(text)) {
    const id = row.id || "";
    const unit = PriceUnit.safeParse(row.unit);
    const amount = Number(row.price);
    if (!id || !row.name || !unit.success || !row.price || !Number.isFinite(amount)) {
      notes.push(`Offer "${row.name || id || "?"}" skipped: needs id, name, a numeric price and a unit (${PriceUnit.options.join(", ")}).`);
      continue;
    }
    if (!vocabulary.offeringKinds.includes(row.kind ?? "")) notes.push(`Offer ${id}: kind "${row.kind}" is not in the vocabulary.`);

    const occasion = mapTerms((row.good_for ?? "").split(","), "offering", vocabulary, "occasion");
    const dietary = mapTerms((row.dietary ?? "").split(/[/,]/), "offering", vocabulary, "dietary");
    const cuisine = mapTerms((row.cuisine ?? "").split(","), "offering", vocabulary, "cuisine");
    const leftovers = [...occasion.leftovers, ...dietary.leftovers, ...cuisine.leftovers];
    if (leftovers.length) notes.push(`Offer ${id}: couldn't map "${leftovers.join('", "')}" to the vocabulary.`);

    const days = row.days ? parseDays(row.days) : undefined;
    if (row.days && !days) notes.push(`Offer ${id}: couldn't read days "${row.days}".`);
    const availability = days || row.time_from || row.time_to ? { days, from: row.time_from || undefined, to: row.time_to || undefined } : undefined;
    const min = row.min_party ? Number(row.min_party) : undefined;
    const max = row.max_party ? Number(row.max_party) : undefined;

    const parsed = Offering.safeParse({
      id,
      kind: row.kind,
      name: row.name,
      description: row.description ?? "",
      price: { amount, currency: row.currency || "EUR", unit: unit.data, from: ["yes", "true", "1"].includes((row.from_price ?? "").toLowerCase()) || undefined },
      attributes: { ...occasion.attributes, ...dietary.attributes, ...cuisine.attributes },
      availability,
      partySize: min || max ? { min, max } : undefined,
      conditions: row.conditions || undefined,
    });
    if (!parsed.success) {
      notes.push(`Offer ${id} skipped: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}.`);
      continue;
    }
    const offering = parsed.data;
    offerings.push({ ...offering, venue: row.venue || undefined });

    const quote = lines.find((l) => l.startsWith(`${id},`));
    findings.push({ field: `offerings[${id}].price`, value: offering.price, evidence: { field: `offerings[${id}].price`, documentId, quote, confidence: 1 } });
    if (offering.conditions) {
      findings.push({ field: `offerings[${id}].conditions`, value: offering.conditions, evidence: { field: `offerings[${id}].conditions`, documentId, quote: offering.conditions, confidence: 1 } });
    }
  }
  return { offerings, findings, notes };
}
