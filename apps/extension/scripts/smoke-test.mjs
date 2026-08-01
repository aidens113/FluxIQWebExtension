import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const file of [
  "src/background/index.ts",
  "src/content/index.ts",
  "src/popup/index.ts",
  "manifest.chrome.json",
  "manifest.firefox.json"
]) {
  await access(path.join(root, file));
}

console.log("Extension smoke test passed.");
