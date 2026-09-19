import { Hono } from "hono";
import { z } from "zod";
import type { BrandAgent } from "../../agents/brand/brand-agent";
import type { Config } from "../../config";
import type { RecordedStreams } from "../../mock/recorded-streams";
import { replay } from "../../mock/replay";
import { streamAgentEvents } from "../sse";

// Live ingest reads a pack from data/sources; uploads come later
const IngestRequest = z.object({ brandId: z.string().regex(/^[a-z0-9-]+$/).default("casa-brisa") });

export function brandRoutes(config: Config, recorded: RecordedStreams | undefined, agent: BrandAgent | undefined) {
  return new Hono().post("/ingest", async (c) => {
    if (recorded) return streamAgentEvents(c, (signal) => replay(recorded.ingest, config.MOCK_SPEED, signal));
    if (!agent) return c.json({ error: "not_implemented" }, 501);
    const body = IngestRequest.safeParse((await c.req.json().catch(() => undefined)) ?? {});
    if (!body.success) return c.json({ error: "invalid_request", details: body.error.issues }, 400);
    return streamAgentEvents(c, (signal) => agent.run(body.data, signal));
  });
}
