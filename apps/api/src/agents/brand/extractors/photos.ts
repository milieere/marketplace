import { readFileSync } from "node:fs";
import { z } from "zod";
import type { Photo } from "@marketplace/contracts/brand-record";
import type { Vocabulary } from "@marketplace/contracts/vocabulary";
import type { Llm } from "../../../ports/llm";
import type { Finding } from "../findings";
import { mapAttributes } from "../normalize";
import { PHOTOS_DOCUMENT, type PackPhoto } from "../read";
import { failed } from "./ask";

const SYSTEM = readFileSync(new URL("../../../prompts/brand-tag-photo.md", import.meta.url), "utf8");

const Tags = z.object({
  description: z.string(),
  attributes: z.record(z.string(), z.array(z.string())),
  confidence: z.number().min(0).max(1),
});

export type PhotoResult = { photo: Photo; finding: Finding; notes: string[] };

export async function tagPhoto(llm: Llm, photo: PackPhoto, vocabulary: Vocabulary): Promise<PhotoResult> {
  const keys = vocabulary.attributes.filter((a) => a.appliesTo.includes("photo")).map((a) => ({ key: a.key, description: a.description, values: a.values }));
  const tags = await llm
    .structured({
      step: `tag-photo:${photo.id}`,
      schema: Tags,
      system: SYSTEM,
      prompt: `Vocabulary: ${JSON.stringify(keys)}\n\nDescribe and tag the attached photo.`,
      images: [{ data: photo.data, mediaType: photo.mediaType }],
    })
    .catch(failed(`photo ${photo.id}`));
  const { attributes, leftovers } = mapAttributes(tags.attributes, "photo", vocabulary);
  const field = `brandKit.photos[${photo.id}].attributes`;
  return {
    photo: { id: photo.id, url: photo.url, description: tags.description, orientation: photo.orientation, attributes },
    finding: { field, value: attributes, evidence: { field, documentId: PHOTOS_DOCUMENT, quote: tags.description, confidence: tags.confidence } },
    notes: leftovers.length ? [`Photo ${photo.id}: dropped tags ${leftovers.join(", ")}.`] : [],
  };
}
