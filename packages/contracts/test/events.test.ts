import { describe, expect, it } from "vitest";
import { AgentEvent } from "../src/events";
import { GenerateRequest } from "../src/requests";

describe("AgentEvent", () => {
  it("rejects unknown event types", () => {
    expect(AgentEvent.safeParse({ type: "surprise" }).success).toBe(false);
  });

  it("rejects an artifact event without html", () => {
    expect(AgentEvent.safeParse({ type: "artifact", artifact: {} }).success).toBe(false);
  });
});

describe("GenerateRequest", () => {
  it("rejects blank text", () => {
    expect(GenerateRequest.safeParse({ text: "   " }).success).toBe(false);
  });

  it("accepts text with optional context", () => {
    const parsed = GenerateRequest.parse({ text: "dinner for two", now: "2026-09-25T18:40:00+02:00", timezone: "Europe/Madrid" });
    expect(parsed.text).toBe("dinner for two");
  });
});
