import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const file of [
  "src/background/index.ts",
  "src/content/index.ts",
  "src/popup/index.ts",
  "src/sidepanel/index.ts",
  "src/panel/index.ts",
  "src/panel/theme/tokens.css",
  "manifest.chrome.json",
  "manifest.firefox.json"
]) {
  await access(path.join(root, file));
}

// Both surfaces are stubs that mount the shared panel UI: the page holds only
// the root, the emitted stylesheet and the bundle, and the entry mounts the
// panel. A page that grew its own markup again would fork the two surfaces.
for (const surface of ["popup", "sidepanel"]) {
  const page = await readFile(path.join(root, "src", surface, "index.html"), "utf8");
  for (const needle of ['id="app"', 'href="./index.css"', 'src="./index.js"']) {
    if (!page.includes(needle)) throw new Error(`src/${surface}/index.html must contain ${needle}.`);
  }
  const entry = await readFile(path.join(root, "src", surface, "index.ts"), "utf8");
  if (!entry.includes(`mountPanel(root, "${surface}")`)) throw new Error(`src/${surface}/index.ts must mount the panel for "${surface}".`);
}

console.log("Extension smoke test passed.");
