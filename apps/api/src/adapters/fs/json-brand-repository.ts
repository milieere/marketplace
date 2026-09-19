import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { BrandRecord } from "@marketplace/contracts/brand-record";
import { Vocabulary } from "@marketplace/contracts/vocabulary";
import { checkBrandRecord } from "../../domain/brand-integrity";
import type { BrandRepository } from "../../ports/brand-repository";

const HOUSE_ID = "_house";

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (err) {
    throw new Error(`Cannot read ${path}`, { cause: err });
  }
}

// Loads and validates every brand once; an invalid file stops startup with the list of problems.
export async function createJsonBrandRepository(dataDir: string): Promise<BrandRepository> {
  const data: { vocabularies: unknown[]; brands: { file: string; json: unknown }[] } = { vocabularies: [], brands: [] };
  try {
    for (const file of await readdir(join(dataDir, "vocabularies"))) {
      data.vocabularies.push(await readJson(join(dataDir, "vocabularies", file)));
    }
    for (const file of (await readdir(join(dataDir, "brands"))).filter((f) => f.endsWith(".json"))) {
      data.brands.push({ file, json: await readJson(join(dataDir, "brands", file)) });
    }
  } catch (err) {
    throw new Error(`Cannot load brand data from ${dataDir}`, { cause: err });
  }

  const vocabularies = new Map<string, Vocabulary>();
  for (const json of data.vocabularies) {
    const vocabulary = Vocabulary.parse(json);
    vocabularies.set(vocabulary.industry, vocabulary);
  }

  const records = new Map<string, BrandRecord>();
  const problems: string[] = [];
  for (const { file, json } of data.brands) {
    const parsed = BrandRecord.safeParse(json);
    if (!parsed.success) {
      problems.push(`${file}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
      continue;
    }
    const vocabulary = vocabularies.get(parsed.data.brand.industry);
    const issues = vocabulary ? checkBrandRecord(parsed.data, vocabulary) : [`no vocabulary for "${parsed.data.brand.industry}"`];
    if (issues.length) problems.push(...issues.map((i) => `${file}: ${i}`));
    else records.set(parsed.data.brand.id, parsed.data);
  }
  if (problems.length) throw new Error(`Invalid brand data:\n  ${problems.join("\n  ")}`);

  const house = records.get(HOUSE_ID);
  if (!house) throw new Error(`Missing ${HOUSE_ID}.json`);

  return {
    listVerified: async () => [...records.values()].filter((r) => r.brand.id !== HOUSE_ID && r.status === "verified"),
    get: async (id) => records.get(id),
    house: async () => house,
    vocabulary: async (industry) => {
      const vocabulary = vocabularies.get(industry);
      if (!vocabulary) throw new Error(`No vocabulary for industry "${industry}"`);
      return vocabulary;
    },
  };
}
