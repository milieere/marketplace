import { z } from "zod";
import type { Location } from "@marketplace/contracts/brand-record";
import type { Vocabulary } from "@marketplace/contracts/vocabulary";
import type { Llm } from "../../../ports/llm";
import { Cite, evidenceFor, type Finding, type Page } from "../findings";
import { grounded, mapAttributes, parseOpeningHours, slug } from "../normalize";
import { ask, failed } from "./ask";

const Locations = z.object({
  locations: z.array(
    z.object({
      name: z.string(),
      address: z.string(),
      timezone: z.string().describe("IANA timezone of the city, e.g. Europe/Madrid"),
      hours: z.array(z.string()).describe("opening-hours lines exactly as printed, one per line"),
      attributes: z.record(z.string(), z.array(z.string())).describe("vocabulary key -> values that the page states"),
      reserveUrl: z.string().nullable(),
      lat: z.number().nullable(),
      lng: z.number().nullable(),
      priceLevel: z.string().nullable().describe("the price-level mark as printed, e.g. €€"),
      cite: z.object({ address: Cite, hours: Cite, attributes: Cite }),
    }),
  ),
});

export type LocationsResult = { locations: Location[]; findings: Finding[]; notes: string[] };

// Hours parsed in code from printed lines, never from the model
export async function extractLocations(llm: Llm, pages: Page[], brandId: string, vocabulary: Vocabulary): Promise<LocationsResult> {
  const keys = vocabulary.attributes.filter((a) => a.appliesTo.includes("location")).map((a) => ({ key: a.key, values: a.values }));
  const task = `List each venue with address, opening hours, reservations and its attributes. Attribute vocabulary: ${JSON.stringify(keys)}`;
  const out = await ask(llm, "locations", Locations, task, pages).catch(failed("locations"));
  const printed = (value: string) => pages.some((p) => grounded(p.text, value));

  const findings: Finding[] = [];
  const notes: string[] = [];
  const locations = out.locations.map((l): Location => {
    const id = slug(l.name).startsWith(brandId) ? slug(l.name) : `${brandId}-${slug(l.name)}`;
    const lines = l.hours.filter((h) => printed(h) || !notes.push(`${l.name}: hours line "${h}" isn't printed in the documents; left out.`));
    const { hours, unparsed } = parseOpeningHours(lines);
    notes.push(...unparsed.map((h) => `${l.name}: couldn't read hours line "${h}".`));
    const { attributes, leftovers } = mapAttributes(l.attributes, "location", vocabulary);
    if (leftovers.length) notes.push(`${l.name}: couldn't map ${leftovers.join(", ")} to the vocabulary.`);
    const level = l.priceLevel && printed(l.priceLevel) ? (l.priceLevel.match(/[€$£]/g)?.length ?? 0) : 0;
    const geo = l.lat !== null && l.lng !== null && printed(String(l.lat)) && printed(String(l.lng)) ? { lat: l.lat, lng: l.lng } : undefined;

    const cite = (field: string, value: unknown, c: Cite) => findings.push({ field: `locations[${id}].${field}`, value, evidence: evidenceFor(`locations[${id}].${field}`, c, pages) });
    cite("address", l.address, l.cite.address);
    cite("openingHours", hours, l.cite.hours);
    cite("attributes", attributes, l.cite.attributes);
    return {
      id,
      name: l.name,
      address: l.address,
      timezone: l.timezone,
      geo,
      openingHours: hours,
      attributes,
      priceLevel: level >= 1 && level <= 4 ? (level as 1 | 2 | 3 | 4) : undefined,
      reserveUrl: l.reserveUrl && printed(l.reserveUrl) ? l.reserveUrl : undefined,
    };
  });
  return { locations, findings, notes };
}
