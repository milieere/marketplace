import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

describe("loadConfig", () => {
  it("rejects a missing Nebius key and names the variable", () => {
    expect(() => loadConfig({})).toThrow(/NEBIUS_API_KEY: required unless MOCK=1/);
  });

  it("treats an empty Nebius key as missing", () => {
    expect(() => loadConfig({ NEBIUS_API_KEY: "" })).toThrow(/NEBIUS_API_KEY/);
  });

  it("allows a missing key in mock mode", () => {
    expect(loadConfig({ MOCK: "1" }).MOCK).toBe(true);
  });

  it("applies defaults", () => {
    const config = loadConfig({ NEBIUS_API_KEY: "test" });
    expect(config.PORT).toBe(8787);
    expect(config.MOCK).toBe(false);
    expect(config.NEBIUS_BASE_URL).toBe("https://api.tokenfactory.nebius.com/v1");
    expect(config.MODEL_TEXT).toBe("deepseek-ai/DeepSeek-V4-Pro");
  });
});
