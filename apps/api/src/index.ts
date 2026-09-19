import { serve } from "@hono/node-server";
import { loadConfig } from "./config";
import { createApp } from "./http/app";

const config = loadConfig(process.env);
const app = createApp(config);

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`api listening on http://localhost:${info.port}${config.MOCK ? " (mock mode)" : ""}`);
});
