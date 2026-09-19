import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HealthResponse } from "@marketplace/contracts/health";
import type { Config } from "../config";
import type { CreativeAgent } from "../agents/creative/creative-agent";
import type { RecordedStreams } from "../mock/recorded-streams";
import type { ArtifactStore } from "../ports/artifact-store";
import { artifactRoutes } from "./routes/artifacts";
import { brandRoutes } from "./routes/brands";
import { generateRoutes } from "./routes/generate";

export type AppDeps = { recorded?: RecordedStreams; agent?: CreativeAgent; artifacts?: ArtifactStore };

// Mock mode sets `recorded`; routes without their agent answer 501.
export function createApp(config: Config, { recorded, agent, artifacts }: AppDeps = {}) {
  const app = new Hono();

  app.use(cors());

  app.get("/health", (c) => c.json<HealthResponse>({ status: "ok", mock: config.MOCK }));
  app.route("/v1/generate", generateRoutes(config, recorded, agent));
  app.route("/v1/artifacts", artifactRoutes(artifacts));
  app.route("/v1/brands", brandRoutes(config, recorded));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}
