import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sources = fileURLToPath(new URL("../../../data/sources/", import.meta.url));
const chrome = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

for (const brand of readdirSync(sources, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const html = `${sources}${brand.name}/brand-guidelines.html`;
  if (!existsSync(html)) continue;
  const pdf = `${sources}${brand.name}/brand-guidelines.pdf`;
  // The time budget lets Google Fonts load before printing
  execFileSync(chrome, ["--headless", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=5000", `--print-to-pdf=${pdf}`, `file://${html}`], {
    stdio: "ignore",
  });
  console.log(`wrote ${pdf}`);
}
