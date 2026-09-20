import type { Artifact } from "@marketplace/contracts/artifact";
import type { BrandRecord } from "@marketplace/contracts/brand-record";
import { describe, expect, it } from "vitest";
import { buildFullCardPrompt } from "../../src/templates/card-prompt";
import { cardCurrency, formatPrice, renderCard } from "../../src/templates/card";
import { loadRepository } from "../support";

// Fragments that could only have come from the query. Words like "terrace" are
// excluded on purpose: they are legitimate venue attributes.
const QUERY_ONLY = ["Friday, 8 friends", "8 friends", "one celiac", "~€30 each", "two vegans"];

async function fixture(brandId: string): Promise<{ record: BrandRecord; artifact: Artifact }> {
  const record = (await loadRepository()).get(brandId) as unknown as Promise<BrandRecord | undefined>;
  const resolved = (await record)!;
  const offering = resolved.offerings[0]!;
  const photo = resolved.brandKit.photos[0]!;
  const logo = resolved.brandKit.logos[0];
  return {
    record: resolved,
    artifact: {
      id: `art-test-${brandId}`,
      intentId: "int-test",
      needIds: ["n1"],
      brandId: resolved.brand.id,
      locationId: resolved.locations[0]?.id,
      offeringIds: [offering.id],
      language: "es",
      format: "card",
      tone: { formality: 0.4, energy: 0.6 },
      slots: {
        headline: "Una mesa para ocho, sin prisa",
        subline: "Terraza en El Born",
        body: "Comida mediterránea para compartir entre amigos.",
        badges: ["🌱 Vegan", "Terraza"],
        cta: { label: "Reservar para 8", url: "https://example.com/reserve" },
      },
      priceLines: [{ offeringId: offering.id, label: offering.name, amount: offering.price.amount, unit: offering.price.unit, from: offering.price.from ?? false }],
      photoId: photo.id,
      presentation: {
        brand: { id: resolved.brand.id, name: resolved.brand.name, summary: resolved.brand.summary },
        kit: {
          colors: resolved.brandKit.colors,
          typography: resolved.brandKit.typography,
          logos: resolved.brandKit.logos,
          style: resolved.brandKit.style,
          voice: resolved.brandKit.voice,
          imagery: resolved.brandKit.imagery,
        },
        photo: { id: photo.id, src: "data:image/jpeg;base64,UEhPVE8=", alt: photo.description, orientation: photo.orientation },
        logo: logo ? { src: "data:image/svg+xml;base64,TE9HTw==" } : undefined,
      },
      trace: [],
      check: { passed: true, issues: [] },
      relaxed: [],
      htmlUrl: "/v1/artifacts/art-test",
      createdAt: "2026-09-18T17:00:00+02:00",
    },
  };
}

describe("buildFullCardPrompt", () => {
  it("sets every supplied string verbatim, and nothing else", async () => {
    const { record, artifact } = await fixture("casa-brisa");
    const { prompt } = buildFullCardPrompt({ artifact, record });

    expect(prompt).toContain(artifact.slots.subline!);
    expect(prompt).toContain(record.locations[0]!.name);
    // the price is copied from Offering data, formatted by the one shared helper
    expect(prompt).toContain(formatPrice(artifact.priceLines[0]!, cardCurrency(record, artifact.priceLines), "es"));
    expect(prompt).toContain(`"price": ${JSON.stringify(formatPrice(artifact.priceLines[0]!, cardCurrency(record, artifact.priceLines), "es"))}`);
  });

  it("never leaks the user's query into the picture", async () => {
    const { record, artifact } = await fixture("casa-brisa");
    const { prompt, system } = buildFullCardPrompt({ artifact, record });
    for (const fragment of QUERY_ONLY) {
      expect(prompt, `prompt leaked "${fragment}"`).not.toContain(fragment);
      expect(system, `system leaked "${fragment}"`).not.toContain(fragment);
    }
  });

  it("leaves the badges and the reserve button out of the picture", async () => {
    const { record, artifact } = await fixture("casa-brisa");
    const { prompt, system } = buildFullCardPrompt({ artifact, record });
    // Only the inventory is drawn; the words may still appear as art direction
    const inventory = prompt.slice(prompt.indexOf("TEXT TO SET"), prompt.indexOf("LAYOUT —"));

    expect(inventory).not.toMatch(/"badges?"|"cta"/);
    expect(inventory).not.toContain("Vegan");
    expect(inventory).not.toContain("🌱");
    expect(inventory).not.toContain(artifact.slots.cta.label);
    expect(prompt).not.toMatch(/call[- ]to[- ]action bar/i);
    expect(system).toMatch(/No pills, tags, chips, buttons/);
  });

  it("sets one sentence of body, not the whole paragraph", async () => {
    // cafe-lumen is balanced, so its recipe keeps a line of copy
    const { record, artifact } = await fixture("cafe-lumen");
    const long = { ...artifact, slots: { ...artifact.slots, body: "First sentence here. Second one should not appear." } };
    const { prompt } = buildFullCardPrompt({ artifact: long, record });

    expect(prompt).toContain('"line": "First sentence here."');
    expect(prompt).not.toContain("Second one should not appear");
  });

  it("leaves the brand lockup to be composited, never drawn", async () => {
    const { record, artifact } = await fixture("casa-brisa");
    const { prompt } = buildFullCardPrompt({ artifact, record });

    expect(prompt).not.toContain(record.brand.name.toLocaleUpperCase());
    expect(prompt).toMatch(/Draw NO logo, mark, emblem/);
    expect(prompt).toMatch(/Leave the top band of the card visually clear/);
  });

  it("gives each brand a different mix of elements", async () => {
    const airy = await fixture("casa-brisa");
    const balanced = await fixture("cafe-lumen");
    const dense = await fixture("nami-ramen");

    const of = (f: Awaited<ReturnType<typeof fixture>>) => buildFullCardPrompt({ artifact: f.artifact, record: f.record }).prompt;
    const [a, b, d] = [of(airy), of(balanced), of(dense)];

    expect(a).not.toContain('"line":');
    expect(b).toContain('"line":');
    expect(d).not.toContain('"subline":');
    expect(new Set([a, b, d].map((p) => p.match(/The feel: (.*)\./)?.[1])).size).toBe(3);
  });

  it("inventories the non-ASCII characters so diacritics survive", async () => {
    const { record, artifact } = await fixture("casa-brisa");
    const { prompt } = buildFullCardPrompt({ artifact, record });
    const line = prompt.split("\n").find((l) => l.startsWith("The only non-ASCII characters"))!;
    expect(line).toContain("ú");
    expect(line).toContain("€");
  });

  it("asks for text, unlike the background-only prompt", async () => {
    const { record, artifact } = await fixture("casa-brisa");
    const { prompt, system } = buildFullCardPrompt({ artifact, record });
    expect(`${system}${prompt}`).not.toContain("no readable text");
    expect(system).toContain("Reproduce each string character for character");
  });

  it("spends the brand's own data on art direction", async () => {
    const { record, artifact } = await fixture("casa-brisa");
    const { prompt } = buildFullCardPrompt({ artifact, record });
    const kit = record.brandKit;
    expect(prompt).toContain(kit.imagery.style);
    expect(prompt).toContain(kit.voice.summary);
    expect(prompt).toContain(kit.voice.samples[0]!);
    expect(prompt).toContain(kit.voice.dontSay[0]!);
    expect(prompt).toContain(kit.typography.find((t) => t.role === "display")!.family);
    for (const rule of kit.rules) expect(prompt).toContain(rule.text);
    expect(prompt).toContain(record.brand.summary);
  });

  it("sends only the photo, since the mark is composited afterwards", async () => {
    const { record, artifact } = await fixture("casa-brisa");
    const built = buildFullCardPrompt({ artifact, record });
    expect(built.referenceImages).toEqual(["data:image/jpeg;base64,UEhPVE8="]);
    expect(built.aspectRatio).toBe("3:4");
  });

  it("never leaks a font weight as a drawable number", async () => {
    const { record, artifact } = await fixture("casa-brisa");
    const { prompt } = buildFullCardPrompt({ artifact, record });
    const type = prompt.slice(prompt.indexOf("TYPE"), prompt.indexOf("COLOUR"));
    expect(type).not.toMatch(/\b[3-9]00\b/);
    expect(type).toMatch(/bold|semibold|medium|regular/);
  });

  it("shows the same strings the HTML card shows", async () => {
    const { record, artifact } = await fixture("verde");
    const currency = cardCurrency(record, artifact.priceLines);
    const { html } = renderCard({
      record,
      language: artifact.language,
      slots: artifact.slots,
      priceLines: artifact.priceLines,
      currency,
      location: record.locations[0],
    });
    const { prompt } = buildFullCardPrompt({ artifact, record });

    // The image drops the badges and the button, so compare only what both render
    const visible = [artifact.slots.headline, record.locations[0]!.name, formatPrice(artifact.priceLines[0]!, currency, artifact.language)];
    for (const text of visible) {
      expect(html, `HTML is missing ${text}`).toContain(text);
      expect(prompt, `prompt is missing ${text}`).toContain(text);
    }
  });

  it("uses each brand's own layout proportions", async () => {
    for (const [brandId, aspect] of [["casa-brisa", "3:4"], ["verde", "4:5"], ["terrat", "3:2"]] as const) {
      const { record, artifact } = await fixture(brandId);
      expect(buildFullCardPrompt({ artifact, record }).aspectRatio, brandId).toBe(aspect);
    }
  });
});
