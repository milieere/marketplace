import { z } from "zod";
import { Artifact, NoMatch, Relaxation } from "./artifact";
import { BrandRecord, Evidence } from "./brand-record";
import { Intent } from "./intent";

export const AgentEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("step"),
    agent: z.enum(["brand", "creative"]),
    id: z.string(),
    label: z.string(),
    status: z.enum(["started", "done", "failed"]),
    detail: z.string().optional(),
  }),
  z.object({ type: z.literal("finding"), field: z.string(), value: z.unknown(), evidence: Evidence.optional() }),
  z.object({ type: z.literal("record"), record: BrandRecord }),
  z.object({ type: z.literal("intent"), intent: Intent }),
  z.object({
    type: z.literal("matches"),
    brands: z.array(z.object({ id: z.string(), name: z.string(), needIds: z.array(z.string()), rationale: z.string() })),
  }),
  z.object({ type: z.literal("relaxed"), relaxations: z.array(Relaxation) }),
  z.object({ type: z.literal("revision"), brandId: z.string(), issues: z.array(z.string()) }),
  z.object({ type: z.literal("artifact"), artifact: Artifact, html: z.string() }),
  z.object({ type: z.literal("visual"), artifactId: z.string(), imageUrl: z.string(), prompt: z.string().optional() }),
  z.object({ type: z.literal("no-match"), noMatch: NoMatch }),
  z.object({ type: z.literal("error"), message: z.string() }),
  z.object({ type: z.literal("done") }),
]);
export type AgentEvent = z.infer<typeof AgentEvent>;
export type AgentEventType = AgentEvent["type"];

export const RecordedStream = z.object({
  scenario: z.string(),
  description: z.string(),
  match: z.string(),
  events: z.array(z.object({ delayMs: z.number().int().nonnegative(), event: AgentEvent })),
});
export type RecordedStream = z.infer<typeof RecordedStream>;
