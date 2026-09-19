import { join } from "node:path";
import { createJsonBrandRepository } from "../src/adapters/fs/json-brand-repository";

export const DATA_DIR = join(import.meta.dirname, "..", "..", "..", "data");
export const loadRepository = () => createJsonBrandRepository(DATA_DIR);
