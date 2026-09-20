import type { Artifact } from "@marketplace/contracts/artifact";
import type { Intent } from "@marketplace/contracts/intent";
import { describe, expect, it } from "vitest";
import { buildImagePrompt, createNebiusImageVisualGenerator } from "../../../src/adapters/openai/image-visual-generator";
import { loadRepository } from "../../support";

function testIntent(): Intent {
  return {
    id: "intent-test",
    raw: { text: "Dinner for 8 friends, vegan, gluten free, terrace, around 30 euros each", inputs: [{ kind: "text" }] },
    scope: "in-domain",
    language: "en",
    party: { size: 8, relation: "friends" },
    budget: { amount: 30, per: "person" },
    phrases: ["8 friends", "vegan", "gluten free", "terrace"],
    needs: [
      {
        id: "need-dinner",
        label: "dinner",
        party: { size: 8 },
        budget: { amount: 30, per: "person" },
        required: { dietary: ["vegan", "gluten-free"], amenities: ["terrace"] },
        preferred: { mood: ["social"] },
        avoid: {},
        wishes: ["easy to reserve"],
        brandIds: [],
      },
    ],
    assumed: [],
    dropped: [],
    missing: [],
  };
}

async function testArtifact(): Promise<{ artifact: Artifact; intent: Intent }> {
  const repo = await loadRepository();
  const record = (await repo.get("verde"))!;
  const offering = record.offerings[0]!;
  const photo = record.brandKit.photos[0]!;
  return {
    intent: testIntent(),
    artifact: {
      id: "artifact-verde",
      intentId: "intent-test",
      needIds: ["need-dinner"],
      brandId: record.brand.id,
      locationId: record.locations[0]?.id,
      offeringIds: [offering.id],
      language: "en",
      format: "card",
      tone: { formality: 0.5, energy: 0.65 },
      slots: {
        headline: "A terrace table for everyone",
        subline: "Plant-forward and gluten free",
        body: "A warm dinner option for your group tonight.",
        badges: ["Vegan", "Gluten free", "Terrace"],
        cta: { label: "Reserve", url: "https://example.com" },
      },
      priceLines: [{ offeringId: offering.id, label: offering.name, amount: offering.price.amount, unit: offering.price.unit, from: false }],
      photoId: photo.id,
      trace: [],
      check: { passed: true, issues: [] },
      relaxed: [],
      htmlUrl: "/artifacts/artifact-verde.html",
      createdAt: "2026-09-18T17:00:00+02:00",
    },
  };
}

describe("Nebius image visual generator", () => {
  it("builds a prompt from the exact selected brand, offering, photo and intent data", async () => {
    const repo = await loadRepository();
    const record = (await repo.get("verde"))!;
    const { artifact, intent } = await testArtifact();
    const prompt = buildImagePrompt({ artifact, record, intent });

    expect(prompt).toContain("Dinner for 8 friends");
    expect(prompt).toContain(record.brand.name);
    expect(prompt).toContain(record.offerings[0]!.name);
    expect(prompt).toContain(record.brandKit.photos[0]!.description);
    expect(prompt).toContain(record.brandKit.colors[0]!.hex);
    expect(prompt).toContain("no readable text, no letters, no numbers, no prices");
    expect(prompt).toContain("Frontend overlay copy, do not render it inside the image");
  });

  it("posts the prompt to the image API and returns a data image URL", async () => {
    const repo = await loadRepository();
    const record = (await repo.get("verde"))!;
    const { artifact, intent } = await testArtifact();
    let requestBody: unknown;
    const generator = createNebiusImageVisualGenerator({
      apiKey: "test-key",
      baseURL: "https://api.tokenfactory.nebius.test/v1",
      model: "black-forest-labs/flux-schnell",
      size: "1024x1024",
      responseExtension: "webp",
      inferenceSteps: 28,
      seed: 123456,
      fetcher: async (_url: string, init: { body: string }) => {
        requestBody = JSON.parse(init.body);
        return new Response(JSON.stringify({ data: [{ b64_json: "ZmFrZS1qcGVn" }] }), { status: 200 });
      },
    });

    const visual = await generator.generate({ artifact, record, intent });

    expect(requestBody).toMatchObject({
      model: "black-forest-labs/flux-schnell",
      size: "1024x1024",
      response_format: "b64_json",
      response_extension: "webp",
      num_inference_steps: 28,
      seed: 123456,
    });
    expect((requestBody as { prompt: string }).prompt).toContain(record.brand.name);
    expect((requestBody as { prompt: string }).prompt).toContain(record.offerings[0]!.name);
    expect((requestBody as { negative_prompt: string }).negative_prompt).toContain("readable text");
    expect(visual).toMatchObject({ artifactId: artifact.id, imageUrl: "data:image/webp;base64,ZmFrZS1qcGVn" });
  });
});
