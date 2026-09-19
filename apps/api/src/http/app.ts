import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HealthResponse } from "@marketplace/contracts/health";
import type { Config } from "../config";
import type { RecordedStreams } from "../mock/recorded-streams";
import { brandRoutes } from "./routes/brands";
import { generateRoutes } from "./routes/generate";

// `recorded` is set only in mock mode; without it the agent routes answer 501 until the agents exist.
export function createApp(config: Config, recorded?: RecordedStreams) {
  const app = new Hono();

  app.use(cors());

  app.get("/health", (c) => c.json<HealthResponse>({ status: "ok", mock: config.MOCK }));
  app.route("/v1/generate", generateRoutes(config, recorded));
  app.route("/v1/brands", brandRoutes(config, recorded));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}
