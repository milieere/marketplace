import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { SourceFile, SourcePacks } from "../../ports/source-packs";

// PDF authoring source and answer key aren't brand input
const IGNORED = new Set(["brand-guidelines.html", "expected.json"]);

export function createFsSourcePacks(sourcesDir: string): SourcePacks {
  return {
    async load(brandId) {
      if (!/^[a-z0-9-]+$/.test(brandId)) return undefined;
      const root = join(sourcesDir, brandId);
      const entries = await readdir(root, { recursive: true, withFileTypes: true }).catch(() => undefined);
      if (!entries) return undefined;
      const files: SourceFile[] = [];
      for (const e of entries.filter((e) => e.isFile() && !e.name.startsWith(".") && !IGNORED.has(e.name))) {
        const path = join(e.parentPath, e.name);
        try {
          files.push({ path: relative(root, path), bytes: new Uint8Array(await readFile(path)) });
        } catch (err) {
          throw new Error(`Cannot read source file ${path}`, { cause: err });
        }
      }
      return files;
    },
  };
}
