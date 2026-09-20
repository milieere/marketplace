import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { glob } from "node:fs/promises";
import sharp from "sharp";

// fal reference images must be raster, so every SVG mark ships with a PNG twin.
// Committed, so the runtime never needs sharp.
const SIZE = 512;
const root = fileURLToPath(new URL("../../../", import.meta.url));

let count = 0;
for await (const entry of glob("data/sources/*/logo*.svg", { cwd: root })) {
  const svg = await readFile(`${root}${entry}`);
  const png = await sharp(svg, { density: 384 })
    .resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await writeFile(`${root}${entry.replace(/\.svg$/, ".png")}`, png);
  count++;
}
console.log(`rasterized ${count} logo marks to ${SIZE}px PNG`);
