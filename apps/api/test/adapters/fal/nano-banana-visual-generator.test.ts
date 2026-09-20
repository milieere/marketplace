import type { Artifact } from "@marketplace/contracts/artifact";
import type { BrandRecord } from "@marketplace/contracts/brand-record";
import type { Intent } from "@marketplace/contracts/intent";
import { describe, expect, it } from "vitest";
import { createFalVisualGenerator } from "../../../src/adapters/fal/nano-banana-visual-generator";
import { loadRepository } from "../../support";

function testIntent(): Intent {
  return {
    id: "int-test",
    raw: { text: "Dinner for 8 on a terrace", inputs: [{ kind: "text" }] },
    scope: "in-domain",
    language: "en",
    party: { size: 8 },
    phrases: [],
    needs: [{ id: "n1", label: "dinner", party: { size: 8 }, required: {}, preferred: {}, avoid: {}, wishes: [], brandIds: [] }],
    assumed: [],
    dropped: [],
    missing: [],
  };
}

async function fixture(): Promise<{ record: BrandRecord; artifact: Artifact; intent: Intent }> {
  const record = (await (await loadRepository()).get("casa-brisa"))! as BrandRecord;
  const offering = record.offerings[0]!;
  const photo = record.brandKit.photos[0]!;
  return {
    record,
    intent: testIntent(),
    artifact: {
      id: "art-test-casa-brisa",
      intentId: "int-test",
      needIds: ["n1"],
      brandId: record.brand.id,
      locationId: record.locations[0]?.id,
      offeringIds: [offering.id],
      language: "es",
      format: "card",
      tone: { formality: 0.4, energy: 0.6 },
      slots: { headline: "Una mesa para ocho", body: "Para compartir.", badges: [], cta: { label: "Reservar", url: "https://example.com" } },
      priceLines: [{ offeringId: offering.id, label: offering.name, amount: offering.price.amount, unit: offering.price.unit, from: false }],
      photoId: photo.id,
      presentation: {
        brand: { id: record.brand.id, name: record.brand.name, summary: record.brand.summary },
        kit: {
          colors: record.brandKit.colors,
          typography: record.brandKit.typography,
          logos: record.brandKit.logos,
          style: record.brandKit.style,
          voice: record.brandKit.voice,
          imagery: record.brandKit.imagery,
        },
        photo: { id: photo.id, src: "data:image/jpeg;base64,UEhPVE8=", alt: photo.description, orientation: photo.orientation },
        logo: { src: "data:image/svg+xml;base64,TE9HTw==" },
      },
      trace: [],
      check: { passed: true, issues: [] },
      relaxed: [],
      htmlUrl: "/v1/artifacts/art-test",
      createdAt: "2026-09-18T17:00:00+02:00",
    },
  };
}

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("fal nano-banana visual generator", () => {
  it("posts the full card to the reference-image endpoint", async () => {
    const { record, artifact, intent } = await fixture();
    let url = "";
    let body: Record<string, unknown> = {};
    const generator = createFalVisualGenerator({
      apiKey: "test-key",
      mode: "full-card",
      fetcher: async (requestUrl, init) => {
        url = requestUrl;
        body = JSON.parse(init.body);
        expect(init.headers.authorization).toBe("Key test-key");
        return ok({ images: [{ url: "https://fal.media/files/card.png" }] });
      },
    });

    const visual = await generator.generate({ artifact, record, intent });

    expect(url).toBe("https://fal.run/fal-ai/nano-banana/edit");
    expect(body).toMatchObject({ aspect_ratio: "3:4", resolution: "2K", output_format: "png", num_images: 1 });
    expect(body.image_urls).toEqual(["data:image/jpeg;base64,UEhPVE8="]);
    expect(body.system_prompt).toContain("character for character");
    expect(visual).toMatchObject({ artifactId: artifact.id, imageUrl: "https://fal.media/files/card.png", mode: "full-card" });
  });

  it("keeps every word out of the scene, since the DOM renders the copy", async () => {
    const { record, artifact, intent } = await fixture();
    let body: Record<string, unknown> = {};
    const generator = createFalVisualGenerator({
      apiKey: "k",
      mode: "scene",
      fetcher: async (_url, init) => {
        body = JSON.parse(init.body);
        return ok({ images: [{ url: "https://fal.media/files/scene.png" }] });
      },
    });

    const visual = await generator.generate({ artifact, record, intent });
    const prompt = body.prompt as string;

    expect(prompt).toMatch(/no text, letters, numbers, words/i);
    expect(prompt).not.toContain(artifact.slots.headline);
    expect(prompt).not.toContain("28");
    expect(body.system_prompt).toBeUndefined();
    expect(visual.mode).toBe("scene");
  });

  it("falls back to text-to-image when the brand has no reference images", async () => {
    const { record, artifact, intent } = await fixture();
    const bare = { ...artifact, presentation: { ...artifact.presentation!, photo: undefined } };
    let url = "";
    const generator = createFalVisualGenerator({
      apiKey: "k",
      mode: "full-card",
      fetcher: async (requestUrl) => {
        url = requestUrl;
        return ok({ images: [{ url: "https://fal.media/files/x.png" }] });
      },
    });

    await generator.generate({ artifact: bare, record, intent });
    expect(url).toBe("https://fal.run/fal-ai/nano-banana");
  });

  it("keeps the colleague's background prompt on the background mode", async () => {
    const { record, artifact, intent } = await fixture();
    let body: Record<string, unknown> = {};
    const generator = createFalVisualGenerator({
      apiKey: "k",
      mode: "background",
      fetcher: async (_url, init) => {
        body = JSON.parse(init.body);
        return ok({ images: [{ url: "https://fal.media/files/bg.png" }] });
      },
    });

    const visual = await generator.generate({ artifact, record, intent });
    expect(body.prompt).toContain("no readable text");
    expect(body.image_urls).toBeUndefined();
    expect(visual.mode).toBe("background");
  });

  it("gives the same artifact the same seed twice", async () => {
    const { record, artifact, intent } = await fixture();
    const seeds: unknown[] = [];
    const generator = createFalVisualGenerator({
      apiKey: "k",
      mode: "full-card",
      fetcher: async (_url, init) => {
        seeds.push(JSON.parse(init.body).seed);
        return ok({ images: [{ url: "https://fal.media/files/x.png" }] });
      },
    });

    await generator.generate({ artifact, record, intent });
    await generator.generate({ artifact, record, intent });
    expect(seeds[0]).toBe(seeds[1]);
  });

  it("retries the non-deterministic 422 refusal with a new seed", async () => {
    const { record, artifact, intent } = await fixture();
    const seeds: unknown[] = [];
    const generator = createFalVisualGenerator({
      apiKey: "k",
      mode: "full-card",
      fetcher: async (_url, init) => {
        seeds.push(JSON.parse(init.body).seed);
        if (seeds.length === 1) {
          return new Response('{"detail":[{"msg":"Could not generate images with the given prompts and images."}]}', { status: 422 });
        }
        return ok({ images: [{ url: "https://fal.media/files/second.png" }] });
      },
    });

    const visual = await generator.generate({ artifact, record, intent });
    expect(seeds).toHaveLength(2);
    expect(seeds[0]).not.toBe(seeds[1]);
    expect(visual.imageUrl).toBe("https://fal.media/files/second.png");
  });

  it("gives up rather than retrying when the account is out of credit", async () => {
    const { record, artifact, intent } = await fixture();
    let calls = 0;
    const generator = createFalVisualGenerator({
      apiKey: "k",
      mode: "full-card",
      fetcher: async () => {
        calls++;
        return new Response('{"detail":"User is locked. Reason: TOP_UP."}', { status: 403 });
      },
    });

    await expect(generator.generate({ artifact, record, intent })).rejects.toThrow(/TOP_UP/);
    expect(calls).toBe(1);
  });

  it("reports what fal said when it refuses", async () => {
    const { record, artifact, intent } = await fixture();
    const generator = createFalVisualGenerator({
      apiKey: "k",
      mode: "full-card",
      fetcher: async () => new Response('{"detail":"nope"}', { status: 400 }),
    });

    await expect(generator.generate({ artifact, record, intent })).rejects.toThrow(/400.*nope/);
  });

  it("treats an empty image list as a failure", async () => {
    const { record, artifact, intent } = await fixture();
    const generator = createFalVisualGenerator({
      apiKey: "k",
      mode: "full-card",
      fetcher: async () => ok({ images: [] }),
    });

    await expect(generator.generate({ artifact, record, intent })).rejects.toThrow(/no image/);
  });
});
