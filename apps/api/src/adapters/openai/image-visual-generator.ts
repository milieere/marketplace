import type { Artifact } from "@marketplace/contracts/artifact";
import type { BrandRecord, Offering, Photo } from "@marketplace/contracts/brand-record";
import type { Intent } from "@marketplace/contracts/intent";
import type { Attributes } from "@marketplace/contracts/vocabulary";
import type { VisualGenerator } from "../../ports/visual-generator";

type Fetcher = (url: string, init: { method: "POST"; headers: Record<string, string>; body: string }) => Promise<Response>;

type ImageVisualGeneratorOptions = {
  apiKey: string;
  baseURL: string;
  model: string;
  size: string;
  responseExtension: "jpeg" | "png" | "webp";
  inferenceSteps: number;
  seed?: number;
  fetcher?: Fetcher;
  fallback?: VisualGenerator;
};

type ImageResponse = {
  data?: Array<{ b64_json?: string; url?: string }>;
};

function attrs(attributes: Attributes | undefined): string {
  if (!attributes) return "none";
  const entries = Object.entries(attributes).filter(([, values]) => values.length > 0);
  if (entries.length === 0) return "none";
  return entries.map(([key, values]) => `${key}: ${values.join(", ")}`).join("; ");
}

function price(offering: Offering): string {
  const prefix = offering.price.from ? "from " : "";
  return `${prefix}${offering.price.amount} ${offering.price.currency} per ${offering.price.unit}`;
}

function compactLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function selectedOfferings(record: BrandRecord, artifact: Artifact): Offering[] {
  const ids = new Set(artifact.offeringIds);
  return record.offerings.filter((offering) => ids.has(offering.id));
}

function selectedPhoto(record: BrandRecord, artifact: Artifact): Photo | undefined {
  if (!artifact.photoId) return undefined;
  return record.brandKit.photos.find((photo) => photo.id === artifact.photoId);
}

export function buildImagePrompt(input: { artifact: Artifact; record: BrandRecord; intent: Intent }): string {
  const { artifact, record, intent } = input;
  const kit = record.brandKit;
  const colors = kit.colors.map((c) => `${c.role} ${c.hex}`).join(", ");
  const typography = kit.typography.map((t) => `${t.role}: ${t.family}`).join(", ");
  const offers = selectedOfferings(record, artifact);
  const location = record.locations.find((item) => item.id === artifact.locationId);
  const photo = selectedPhoto(record, artifact);
  const needs = intent.needs.map((need) => {
    const pieces = [
      `label ${need.label}`,
      need.party ? `party ${need.party.size}${need.party.kids ? ` with ${need.party.kids} kids` : ""}` : "",
      need.budget ? `budget ${need.budget.amount} per ${need.budget.per}` : "",
      `required ${attrs(need.required)}`,
      `preferred ${attrs(need.preferred)}`,
      need.wishes.length ? `wishes ${need.wishes.join(", ")}` : "",
    ].filter(Boolean);
    return pieces.join("; ");
  });

  const offerLines = offers.map((offering) =>
    compactLine(
      [
        `${offering.name} (${offering.kind})`,
        offering.description,
        `verified price context: ${price(offering)}`,
        `attributes: ${attrs(offering.attributes)}`,
        offering.conditions ? `conditions: ${offering.conditions}` : "",
      ]
        .filter(Boolean)
        .join("; "),
    ),
  );

  return [
    "Create one high-quality advertising image for a marketplace recommendation result.",
    "The image must visually represent the actual selected brand, offer, user need, and brand kit below.",
    "",
    `User request: ${intent.raw.text}`,
    `Detected needs: ${needs.join(" | ") || "hospitality recommendation"}`,
    intent.party ? `Party context: ${intent.party.size}${intent.party.kids ? ` people, ${intent.party.kids} kids` : " people"}` : "",
    intent.budget ? `Budget context: ${intent.budget.amount} per ${intent.budget.per}` : "",
    "",
    `Brand: ${record.brand.name}`,
    `Brand summary: ${record.brand.summary}`,
    `Brand voice: ${kit.voice.summary}`,
    `Brand colors: ${colors}`,
    `Typography mood: ${typography}`,
    `Style: ${kit.style.composition}, ${kit.style.imageTreatment}, ${kit.style.density} density, ${kit.style.ornament} ornament.`,
    `Imagery style: ${kit.imagery.style}`,
    `Avoid imagery: ${kit.imagery.avoid.join(", ") || "none"}`,
    "",
    `Selected offer data: ${offerLines.join(" | ")}`,
    location ? `Selected location: ${location.name}; ${location.address}; attributes: ${attrs(location.attributes)}` : "",
    photo ? `Reference photo intent: ${photo.description}; orientation ${photo.orientation}; attributes: ${attrs(photo.attributes)}` : "",
    "",
    `Frontend overlay copy, do not render it inside the image: headline "${artifact.slots.headline}", body "${artifact.slots.body}".`,
    "Important constraints: no readable text, no letters, no numbers, no prices, no logos, no signage, no watermark.",
    "Leave clean negative space for UI overlay copy and verified prices rendered by the frontend.",
    "Make it feel like a finished modern advertising visual, not a generic card background.",
  ]
    .filter(Boolean)
    .join("\n");
}

function imageDataUrl(b64: string, extension: ImageVisualGeneratorOptions["responseExtension"]): string {
  const mime = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${b64}`;
}

async function responseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function negativePrompt(input: { record: BrandRecord }): string {
  return [
    "readable text",
    "letters",
    "numbers",
    "prices",
    "brand logo",
    "watermark",
    "signage",
    "poster layout",
    "UI card",
    "generic stock photo",
    ...input.record.brandKit.imagery.avoid,
  ].join(", ");
}

export function createNebiusImageVisualGenerator(options: ImageVisualGeneratorOptions): VisualGenerator {
  const fetcher = options.fetcher ?? fetch;
  const url = `${options.baseURL.replace(/\/$/, "")}/images/generations`;

  return {
    async generate(input) {
      const prompt = buildImagePrompt(input);
      try {
        const response = await fetcher(url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${options.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: options.model,
            prompt,
            size: options.size,
            response_format: "b64_json",
            response_extension: options.responseExtension,
            num_inference_steps: options.inferenceSteps,
            negative_prompt: negativePrompt(input),
            ...(options.seed === undefined ? {} : { seed: options.seed }),
          }),
        });

        if (!response.ok) {
          const detail = compactLine(await responseText(response));
          throw new Error(`Nebius image generation failed (${response.status})${detail ? `: ${detail}` : ""}`);
        }

        const json = (await response.json()) as ImageResponse;
        const image = json.data?.[0];
        const imageUrl = image?.b64_json ? imageDataUrl(image.b64_json, options.responseExtension) : image?.url;
        if (!imageUrl) throw new Error("Nebius image generation returned no image");

        return { artifactId: input.artifact.id, imageUrl, prompt, mode: "background" as const };
      } catch (error) {
        if (!options.fallback) throw error;
        const fallback = await options.fallback.generate(input);
        return {
          artifactId: input.artifact.id,
          imageUrl: fallback.imageUrl,
          mode: fallback.mode,
          prompt: `${prompt}\n\nFallback visual used because image generation failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}
