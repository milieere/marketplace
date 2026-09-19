import type { BrandRecord } from "@marketplace/contracts/brand-record";
import type { Attributes, Vocabulary } from "@marketplace/contracts/vocabulary";

type Target = "location" | "offering" | "photo";

export function checkAttributes(attributes: Attributes, target: Target, vocabulary: Vocabulary, where: string): string[] {
  const issues: string[] = [];
  for (const [key, values] of Object.entries(attributes)) {
    const def = vocabulary.attributes.find((a) => a.key === key);
    if (!def) {
      issues.push(`${where}: unknown attribute "${key}"`);
      continue;
    }
    if (!def.appliesTo.includes(target)) issues.push(`${where}: "${key}" does not apply to a ${target}`);
    for (const value of values) {
      if (!def.values.includes(value)) issues.push(`${where}: "${value}" is not a valid ${key}`);
    }
  }
  return issues;
}

// Evidence paths address list items by id, e.g. offerings[cb-sharing-menu].price.
function evidencePathIssues(record: BrandRecord): string[] {
  const ids: Record<string, Set<string>> = {
    colors: new Set(record.brandKit.colors.map((c) => c.id)),
    photos: new Set(record.brandKit.photos.map((p) => p.id)),
    locations: new Set(record.locations.map((l) => l.id)),
    offerings: new Set(record.offerings.map((o) => o.id)),
  };
  const documents = new Set(record.documents.map((d) => d.id));
  const issues: string[] = [];
  for (const e of record.evidence) {
    if (!documents.has(e.documentId)) issues.push(`evidence ${e.field}: unknown document "${e.documentId}"`);
    for (const [, collection, id] of e.field.matchAll(/(\w+)\[([^\]]+)\]/g)) {
      if (collection && id && !ids[collection]?.has(id)) issues.push(`evidence ${e.field}: unknown ${collection} "${id}"`);
    }
  }
  return issues;
}

export function checkBrandRecord(record: BrandRecord, vocabulary: Vocabulary): string[] {
  const issues: string[] = [];
  const { brand, brandKit, locations, offerings } = record;

  if (brand.industry !== vocabulary.industry) issues.push(`brand industry "${brand.industry}" has no vocabulary`);

  const colorIds = new Set(brandKit.colors.map((c) => c.id));
  for (const c of brandKit.colors) {
    for (const p of c.pairsWith) if (!colorIds.has(p)) issues.push(`color ${c.id}: pairs with unknown color "${p}"`);
  }
  for (const l of brandKit.logos) {
    for (const bg of l.onBackgrounds) if (!colorIds.has(bg)) issues.push(`logo ${l.variant}: unknown background "${bg}"`);
  }
  for (const p of brandKit.photos) issues.push(...checkAttributes(p.attributes, "photo", vocabulary, `photo ${p.id}`));
  for (const l of locations) issues.push(...checkAttributes(l.attributes, "location", vocabulary, `location ${l.id}`));

  const locationIds = new Set(locations.map((l) => l.id));
  for (const o of offerings) {
    if (!vocabulary.offeringKinds.includes(o.kind)) issues.push(`offering ${o.id}: unknown kind "${o.kind}"`);
    for (const id of o.locationIds ?? []) if (!locationIds.has(id)) issues.push(`offering ${o.id}: unknown location "${id}"`);
    issues.push(...checkAttributes(o.attributes, "offering", vocabulary, `offering ${o.id}`));
  }

  issues.push(...evidencePathIssues(record));
  return issues;
}
