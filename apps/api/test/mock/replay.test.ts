import { describe, expect, it } from "vitest";
import type { RecordedStream } from "@marketplace/contracts/events";
import { replay } from "../../src/mock/replay";

const recording: RecordedStream = {
  scenario: "test",
  description: "",
  match: ".*",
  events: [
    { delayMs: 0, event: { type: "step", agent: "creative", id: "a", label: "A", status: "started" } },
    { delayMs: 5000, event: { type: "done" } },
  ],
};

describe("replay", () => {
  it("yields every event in order", async () => {
    const types = [];
    for await (const e of replay(recording, 0, new AbortController().signal)) types.push(e.type);
    expect(types).toEqual(["step", "done"]);
  });

  it("stops without throwing when the client disconnects mid-delay", async () => {
    const abort = new AbortController();
    const types = [];
    const started = Date.now();
    setTimeout(() => abort.abort(), 20);
    for await (const e of replay(recording, 1, abort.signal)) types.push(e.type);
    expect(types).toEqual(["step"]);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
