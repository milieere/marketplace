import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { Rasterizer } from "../../ports/rasterizer";

const run = promisify(execFile);

const CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter((p): p is string => Boolean(p));

async function findChrome(): Promise<string | undefined> {
  for (const path of CANDIDATES) {
    try {
      await readFile(path);
      return path;
    } catch {
      // next candidate
    }
  }
  return undefined;
}

export function createChromeRasterizer(): Rasterizer {
  let resolved: Promise<string | undefined> | undefined;

  return {
    async render(html, size) {
      resolved ??= findChrome();
      const chrome = await resolved;
      if (!chrome) return undefined;

      const dir = await mkdtemp(join(tmpdir(), "card-"));
      try {
        const page = join(dir, "card.html");
        const shot = join(dir, "card.png");
        await writeFile(page, html);
        await run(chrome, [
          "--headless",
          "--disable-gpu",
          "--hide-scrollbars",
          `--window-size=${size.width},${size.height}`,
          `--screenshot=${shot}`,
          "--virtual-time-budget=6000",
          `file://${page}`,
        ]);
        return new Uint8Array(await readFile(shot));
      } catch {
        return undefined;
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
}
