import { Hono } from "hono";
import type { Config } from "../../config";
import type { RecordedStreams } from "../../mock/recorded-streams";
import { replay } from "../../mock/replay";
import { streamAgentEvents } from "../sse";

export function brandRoutes(config: Config, recorded: RecordedStreams | undefined) {
  return new Hono().post("/ingest", (c) => {
    if (!recorded) return c.json({ error: "not_implemented" }, 501);
    return streamAgentEvents(c, (signal) => replay(recorded.ingest, config.MOCK_SPEED, signal));
  });
}
