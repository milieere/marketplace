import { Hono } from "hono";
import { GenerateRequest } from "@marketplace/contracts/requests";
import type { Config } from "../../config";
import type { RecordedStreams } from "../../mock/recorded-streams";
import { replay } from "../../mock/replay";
import { streamAgentEvents } from "../sse";

export function generateRoutes(config: Config, recorded: RecordedStreams | undefined) {
  return new Hono().post("/", async (c) => {
    const body = GenerateRequest.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request", details: body.error.issues }, 400);

    if (!recorded) return c.json({ error: "not_implemented" }, 501);
    const recording = recorded.pickGenerate(body.data.text);
    return streamAgentEvents(c, (signal) => replay(recording, config.MOCK_SPEED, signal));
  });
}
