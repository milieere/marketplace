import { z } from "zod";

export const GenerateRequest = z.object({
  text: z.string().trim().min(1).max(2000),
  now: z.iso.datetime({ offset: true }).optional(),
  timezone: z.string().optional(),
  format: z.enum(["banner", "card"]).optional(),
});
export type GenerateRequest = z.infer<typeof GenerateRequest>;

export const TranscribeResponse = z.object({ text: z.string() });
export type TranscribeResponse = z.infer<typeof TranscribeResponse>;

export const ErrorResponse = z.object({ error: z.string(), details: z.unknown().optional() });
export type ErrorResponse = z.infer<typeof ErrorResponse>;
