import { serve } from "@hono/node-server";
import { loadConfig } from "./config";
import { createApp } from "./http/app";
import { loadRecordedStreams } from "./mock/recorded-streams";

const config = loadConfig(process.env);
const recorded = config.MOCK ? await loadRecordedStreams() : undefined;
const app = createApp(config, recorded);

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`api listening on http://localhost:${info.port}${config.MOCK ? " (mock mode)" : ""}`);
});
