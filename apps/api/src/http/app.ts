import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HealthResponse } from "@marketplace/contracts/health";
import type { Config } from "../config";

export function createApp(config: Config) {
  const app = new Hono();

  app.use(cors());

  app.get("/health", (c) => c.json<HealthResponse>({ status: "ok", mock: config.MOCK }));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}
