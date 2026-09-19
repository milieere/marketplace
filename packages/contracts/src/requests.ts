import { z } from "zod";
import { Intent } from "./intent";
import { Attributes } from "./vocabulary";

export const GenerateRequest = z.object({
  text: z.string().trim().min(1).max(2000),
  now: z.iso.datetime({ offset: true }).optional(),
  timezone: z.string().optional(),
  format: z.enum(["banner", "card"]).optional(),
  // A follow-up ("cheaper", "what about Saturday?") patches the previous intent instead of starting over.
  previousIntent: Intent.optional(),
  // Saved preferences kept by the frontend; defaults that the query overrides.
  profile: z
    .object({
      language: z.string().optional(),
      partySize: z.number().int().positive().optional(),
      required: Attributes.default({}),
      preferred: Attributes.default({}),
      avoid: Attributes.default({}),
    })
    .optional(),
});
export type GenerateRequest = z.infer<typeof GenerateRequest>;

export const TranscribeResponse = z.object({ text: z.string() });
export type TranscribeResponse = z.infer<typeof TranscribeResponse>;

export const ErrorResponse = z.object({ error: z.string(), details: z.unknown().optional() });
export type ErrorResponse = z.infer<typeof ErrorResponse>;
