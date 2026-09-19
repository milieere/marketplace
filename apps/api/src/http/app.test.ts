import { describe, expect, it } from "vitest";
import { HealthResponse } from "@marketplace/contracts/health";
import { loadConfig } from "../config";
import { createApp } from "./app";

describe("GET /health", () => {
  it("returns ok and the mock flag, matching the contract", async () => {
    const app = createApp(loadConfig({ MOCK: "1" }));
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    expect(HealthResponse.parse(await res.json())).toEqual({ status: "ok", mock: true });
  });
});
