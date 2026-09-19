import { Hono } from "hono";
import { z } from "zod";
import { BrandRecord } from "@marketplace/contracts/brand-record";
import type { BrandAgent } from "../../agents/brand/brand-agent";
import type { Config } from "../../config";
import { checkBrandRecord } from "../../domain/brand-integrity";
import type { RecordedStreams } from "../../mock/recorded-streams";
import { replay } from "../../mock/replay";
import type { BrandRepository } from "../../ports/brand-repository";
import { streamAgentEvents } from "../sse";

// Live ingest reads a pack from data/sources; uploads come later
const IngestRequest = z.object({ brandId: z.string().regex(/^[a-z0-9-]+$/).default("casa-brisa") });

export function brandRoutes(config: Config, recorded: RecordedStreams | undefined, agent: BrandAgent | undefined, brands: BrandRepository | undefined) {
  return new Hono()
    .post("/ingest", async (c) => {
      if (recorded) return streamAgentEvents(c, (signal) => replay(recorded.ingest, config.MOCK_SPEED, signal));
      if (!agent) return c.json({ error: "not_implemented" }, 501);
      const body = IngestRequest.safeParse((await c.req.json().catch(() => undefined)) ?? {});
      if (!body.success) return c.json({ error: "invalid_request", details: body.error.issues }, 400);
      return streamAgentEvents(c, (signal) => agent.run(body.data, signal));
    })
    // The reviewer posts back the draft it received from /ingest, edits included
    .post("/:id/verify", async (c) => {
      if (!brands) return c.json({ error: "not_implemented" }, 501);
      const body = BrandRecord.safeParse(await c.req.json().catch(() => undefined));
      if (!body.success) return c.json({ error: "invalid_request", details: body.error.issues }, 400);
      const record = { ...body.data, status: "verified" as const };
      if (record.brand.id !== c.req.param("id")) return c.json({ error: "id_mismatch" }, 400);
      const vocabulary = await brands.vocabulary(record.brand.industry).catch(() => undefined);
      if (!vocabulary) return c.json({ error: "unknown_industry", industry: record.brand.industry }, 400);
      const issues = checkBrandRecord(record, vocabulary);
      if (issues.length) return c.json({ error: "invalid_record", issues }, 422);
      await brands.save(record);
      return c.json({ id: record.brand.id, status: record.status, offerings: record.offerings.length });
    });
}
