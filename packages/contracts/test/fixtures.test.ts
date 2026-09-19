import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BrandRecord } from "../src/brand-record";
import { RecordedStream } from "../src/events";
import { Vocabulary } from "../src/vocabulary";

const root = join(import.meta.dirname, "..", "..", "..");
const fixturesDir = join(import.meta.dirname, "..", "fixtures");
const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

describe("recorded streams", () => {
  const files = readdirSync(fixturesDir).filter((f) => f.endsWith(".json"));

  it("exist", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s validates and ends with done", (file) => {
    const stream = RecordedStream.parse(readJson(join(fixturesDir, file)));
    expect(stream.events.at(-1)?.event.type).toBe("done");
    expect(() => new RegExp(stream.match, "i")).not.toThrow();
  });
});

describe("data files", () => {
  it("vocabulary validates", () => {
    expect(() => Vocabulary.parse(readJson(join(root, "data/vocabularies/hospitality.json")))).not.toThrow();
  });

  it("example brand validates", () => {
    expect(() => BrandRecord.parse(readJson(join(root, "data/brands/example-brand.json")))).not.toThrow();
  });
});
