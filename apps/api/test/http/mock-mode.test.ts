import { beforeAll, describe, expect, it } from "vitest";
import { AgentEvent } from "@marketplace/contracts/events";
import { loadConfig } from "../../src/config";
import { loadRecordedStreams, type RecordedStreams } from "../../src/mock/recorded-streams";
import { createApp } from "../../src/http/app";

function parseSse(body: string): AgentEvent[] {
  return body
    .split("\n\n")
    .map((block) => block.split("\n").find((line) => line.startsWith("data:")))
    .filter((line): line is string => Boolean(line))
    .map((line) => AgentEvent.parse(JSON.parse(line.slice("data:".length))));
}

describe("mock mode", () => {
  let recorded: RecordedStreams;
  beforeAll(async () => {
    recorded = await loadRecordedStreams();
  });
  const mockApp = () => createApp(loadConfig({ MOCK: "1", MOCK_SPEED: "0" }), { recorded });
  const generate = (text: unknown) =>
    mockApp().request("/v1/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });

  it("streams a valid event sequence ending with artifacts and done", async () => {
    const res = await generate("Friday, 8 friends, two vegans, terrace, 30 each");
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const types = parseSse(await res.text()).map((e) => e.type);
    expect(types[0]).toBe("step");
    expect(types.filter((t) => t === "artifact")).toHaveLength(2);
    expect(types.at(-1)).toBe("done");
  });

  it("picks the no-results scenario for a large group", async () => {
    const types = parseSse(await (await generate("vegan dinner for 25 people under 10 euros")).text()).map((e) => e.type);
    expect(types).toContain("no-match");
    expect(types).not.toContain("artifact");
  });

  it("picks the out-of-domain scenario", async () => {
    const events = parseSse(await (await generate("my car is making a weird noise")).text());
    const noMatch = events.find((e) => e.type === "no-match");
    expect(noMatch?.type === "no-match" && noMatch.noMatch.reason).toBe("out-of-domain");
  });

  it("streams the ingest scenario ending with a draft record", async () => {
    const res = await mockApp().request("/v1/brands/ingest", { method: "POST" });
    const events = parseSse(await res.text());
    const record = events.find((e) => e.type === "record");
    expect(record?.type === "record" && record.record.status).toBe("draft");
  });

  it("rejects blank text with 400", async () => {
    expect((await generate("  ")).status).toBe(400);
  });
});

describe("without mock mode", () => {
  it("answers 501 until the agents exist", async () => {
    const app = createApp(loadConfig({ NEBIUS_API_KEY: "test" }));
    const res = await app.request("/v1/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "dinner" }),
    });
    expect(res.status).toBe(501);
  });
});
