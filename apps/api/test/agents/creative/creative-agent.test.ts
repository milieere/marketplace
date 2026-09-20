import type { AgentEvent } from "@marketplace/contracts/events";
import { describe, expect, it } from "vitest";
import { createMemoryArtifactStore } from "../../../src/adapters/memory/artifact-store";
import { createCreativeAgent } from "../../../src/agents/creative/creative-agent";
import type { IntentDraft } from "../../../src/agents/creative/understand";
import { loadConfig } from "../../../src/config";
import { createApp } from "../../../src/http/app";
import type { Llm } from "../../../src/ports/llm";
import type { VisualGenerator } from "../../../src/ports/visual-generator";
import { loadRepository, parseSse } from "../../support";

const NOW = "2026-09-18T17:00:00+02:00";
const FRI_21 = "2026-09-18T21:00:00+02:00";

type Copy = { headline: string; body: string };
type Script = { understand: Partial<IntentDraft>; copy?: (brandId: string, attempt: number) => Partial<Copy> };

// Offer ids read from the prompt: fake can only pick what it was given
function fakeLlm(script: Script) {
  const prompts: Record<string, string[]> = {};
  const llm: Llm = {
    async structured(req) {
      (prompts[req.step] ??= []).push(req.prompt);
      if (req.step === "understand") return req.schema.parse({ language: "en", scope: "in-domain", ...script.understand });
      const brandId = req.step.split(":")[1]!;
      if (req.step.startsWith("design:")) {
        return req.schema.parse({
          idea: `a card for ${brandId}`,
          copyAnchor: "bottom",
          lockup: "top-left",
          scrimStrength: "medium",
          scrimColour: "#2B2118",
          headlineSize: "l",
          headlineUpper: false,
          headlineTracking: "normal",
          headlineColour: "#F6EFE6",
          bodyColour: "#F6EFE6",
          accent: "#F2A541",
          priceTreatment: "hero",
          priceColour: "#F2A541",
          badges: "solid",
          rule: true,
          align: "left",
        });
      }
      const input = JSON.parse(req.prompt.slice("Input:\n".length).split("\n\nYour previous")[0]!);
      const copy = {
        offeringIds: [input.offers[0].id],
        photoId: null,
        headline: "Your table is ready",
        subline: null,
        body: "A good fit for tonight.",
        ctaLabel: "Reserve",
        tone: { formality: 0.5, energy: 0.5 },
        ...script.copy?.(brandId, prompts[req.step]!.length),
      };
      return req.schema.parse(copy);
    },
  };
  return { llm, prompts };
}

async function generate(text: string, script: Script, visuals?: VisualGenerator) {
  const { llm, prompts } = fakeLlm(script);
  const artifacts = createMemoryArtifactStore();
  const agent = createCreativeAgent({ llm, brands: await loadRepository(), artifacts, visuals });
  const app = createApp(loadConfig({ NEBIUS_API_KEY: "test" }), { agent, artifacts });
  const res = await app.request("/v1/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, now: NOW }),
  });
  const events = parseSse(await res.text());
  const artifactsOut = events.flatMap((e) => (e.type === "artifact" ? [e.artifact] : []));
  return { app, events, prompts, artifacts: artifactsOut, types: events.map((e) => (e.type === "step" ? `${e.id}:${e.status}` : e.type)) };
}

const q1: Script = {
  understand: {
    party: { size: 8 },
    budget: { amount: 30, per: "person" },
    phrases: ["8 friends"],
    needs: [{ label: "dinner", when: { start: FRI_21 }, required: { dietary: ["vegan", "gluten-free"], amenities: ["terrace"] }, preferred: {}, avoid: {} }],
  },
};

describe("Creative Agent over HTTP with a scripted LLM", () => {
  it("Q1: streams the recorded event order and two grounded artifacts", async () => {
    const { app, types, artifacts } = await generate("Friday, 8 friends, two vegans, one celiac, terrace, ~€30 each", q1);

    expect(types.slice(0, 8)).toEqual([
      "understand:started",
      "understand:done",
      "intent",
      "filter:started",
      "filter:done",
      "rank:started",
      "rank:done",
      "matches",
    ]);
    expect(types.at(-1)).toBe("done");
    expect(artifacts.map((a) => a.brandId).sort()).toEqual(["casa-brisa", "verde"]);

    const repo = await loadRepository();
    for (const a of artifacts) {
      const record = (await repo.get(a.brandId))!;
      for (const line of a.priceLines) {
        const offering = record.offerings.find((o) => o.id === line.offeringId)!;
        expect(line.amount).toBe(offering.price.amount);
      }
      expect(a.check.passed).toBe(true);
      expect(a.presentation?.brand.name).toBe(record.brand.name);
      expect(a.presentation?.kit.colors).toEqual(record.brandKit.colors);
      expect(a.presentation?.photo?.src).toMatch(/^data:image\//);
      expect(a.slots.badges).toEqual(expect.arrayContaining(["🌱 Vegan", "Gluten free", "Terrace"]));
      const page = await app.request(a.htmlUrl);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain(record.brand.name);
    }
  });

  it("Q9: tells the copy step what couldn't be met and records it on the artifact", async () => {
    const { events, prompts, artifacts } = await generate("Ramen for two tonight, on a terrace", {
      understand: {
        party: { size: 2 },
        needs: [{ label: "ramen", when: { start: FRI_21 }, required: { cuisine: ["japanese"], amenities: ["terrace"] }, preferred: {}, avoid: {} }],
      },
    });
    expect(events.find((e) => e.type === "relaxed")).toMatchObject({ relaxations: [{ constraint: "amenities:terrace" }] });
    expect(artifacts.map((a) => a.brandId)).toEqual(["nami-ramen"]);
    expect(artifacts[0]!.relaxed.map((r) => r.constraint)).toEqual(["amenities:terrace"]);
    expect(prompts["create:nami-ramen"]![0]).toContain('"couldNotMeet":["amenities:terrace"]');
  });

  it("Q10: ends in a no-results fallback without writing any ads", async () => {
    const { events, prompts } = await generate("Vegan dinner for 25 people under €10 each", {
      understand: {
        party: { size: 25 },
        budget: { amount: 10, per: "person" },
        needs: [{ label: "dinner", when: { start: FRI_21 }, required: { dietary: ["vegan"] }, preferred: {}, avoid: {} }],
      },
    });
    const noMatch = events.find((e): e is Extract<AgentEvent, { type: "no-match" }> => e.type === "no-match");
    expect(noMatch?.noMatch.reason).toBe("no-results");
    expect(noMatch?.noMatch.html).toContain("INTENT");
    expect(Object.keys(prompts)).toEqual(["understand"]);
  });

  it("Q11: answers off-topic requests with the out-of-domain fallback", async () => {
    const { types, events } = await generate("My car is making a weird noise", { understand: { scope: "out-of-domain", needs: [] } });
    expect(types).toEqual(["understand:started", "understand:done", "intent", "no-match", "done"]);
    const noMatch = events.find((e): e is Extract<AgentEvent, { type: "no-match" }> => e.type === "no-match");
    expect(noMatch?.noMatch.reason).toBe("out-of-domain");
  });

  it("rewrites copy that states a price, and shows the revision", async () => {
    const { events, artifacts } = await generate("Friday, 8 friends, two vegans, one celiac, terrace, ~€30 each", {
      ...q1,
      copy: (brandId, attempt) => (brandId === "verde" && attempt === 1 ? { body: "Only €22 each for the group menu." } : {}),
    });
    expect(events.find((e) => e.type === "revision")).toMatchObject({ brandId: "verde", issues: [expect.stringContaining("no-prices-in-copy")] });
    const verde = artifacts.find((a) => a.brandId === "verde")!;
    expect(verde.slots.body).not.toContain("€");
    expect(verde.check.passed).toBe(true);
  });

  it("streams a generated visual after each artifact when a visual generator is configured", async () => {
    const visuals: VisualGenerator = {
      async generate({ artifact, record, intent }) {
        return {
          artifactId: artifact.id,
          imageUrl: "data:image/jpeg;base64,ZmFrZQ==",
          prompt: `${record.brand.name} | ${intent.raw.text} | ${artifact.offeringIds.join(",")}`,
          mode: "full-card" as const,
        };
      },
    };
    const { events, artifacts, types } = await generate("Friday, 8 friends, two vegans, one celiac, terrace, ~€30 each", q1, visuals);
    const visualEvents = events.filter((e): e is Extract<AgentEvent, { type: "visual" }> => e.type === "visual");

    expect(visualEvents).toHaveLength(artifacts.length);
    expect(visualEvents[0]).toMatchObject({ artifactId: artifacts[0]!.id, imageUrl: "data:image/jpeg;base64,ZmFrZQ==", mode: "full-card" });
    expect(visualEvents[0]?.prompt).toContain("Friday, 8 friends");
    expect(types).toContain("visual-casa-brisa:started");
    expect(types).toContain("visual-casa-brisa:done");
  });

  it("ships the vector mark and a layout for the card to render", async () => {
    const { artifacts } = await generate("Friday, 8 friends, two vegans, one celiac, terrace, ~€30 each", q1);
    const withLogo = artifacts.filter((a) => a.presentation?.logo);

    expect(withLogo.length).toBeGreaterThan(0);
    for (const artifact of withLogo) {
      // The DOM draws the mark now, so it wants the crisp vector
      expect(artifact.presentation!.logo!.src.startsWith("data:image/svg+xml;base64,"), artifact.brandId).toBe(true);
      expect(artifact.presentation!.layout, artifact.brandId).toBeDefined();
    }
    // Two brands, two different layouts
    const frames = new Set(artifacts.map((a) => a.presentation?.layout?.copyAnchor));
    expect(frames.size).toBeGreaterThan(1);
  });

  it("reports a failed visual step and still finishes the stream", async () => {
    const visuals: VisualGenerator = {
      async generate() {
        throw new Error("fal is out of credit");
      },
    };
    const { events, types } = await generate("Friday, 8 friends, two vegans, one celiac, terrace, ~€30 each", q1, visuals);

    expect(types).toContain("visual-casa-brisa:started");
    expect(types).toContain("visual-casa-brisa:failed");
    expect(events.filter((e) => e.type === "visual")).toHaveLength(0);
    expect(events.at(-1)?.type).toBe("done");
  });

  it("keeps streaming when one brand's copy step fails", async () => {
    const { events, artifacts, types } = await generate("Friday, 8 friends, two vegans, one celiac, terrace, ~€30 each", {
      ...q1,
      copy: (brandId) => {
        if (brandId === "verde") throw new Error("model timeout");
        return {};
      },
    });
    expect(artifacts.map((a) => a.brandId)).toEqual(["casa-brisa"]);
    expect(events).toContainEqual(expect.objectContaining({ type: "step", id: "create-verde", status: "failed" }));
    expect(types.at(-1)).toBe("done");
  });
});
