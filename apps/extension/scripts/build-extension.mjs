import { copyFile, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = path.join(root, "build");
const distDir = path.join(root, "dist");
const placeholderPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAI" +
  "AAAACACAYAAADDPmHLAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAA" +
  "AadJREFUeNrs3cENwjAQRUEj/Rd2gBqogZqogcqogXqohRFhh5QYe77cuZkOAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAwN8k7vO+3+4D+JvjdYAfQAAQAAQAAQAAQAAQAAQAAQAA" +
  "QAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAA" +
  "QAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAA" +
  "QAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAA" +
  "QAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAA" +
  "QAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAA" +
  "QAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAA" +
  "QAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAAQAA" +
  "QAAQAAQAAQAAQAAQAAQAAQAAQAASDU/HAD5WUMR2QAAAABJRU5ErkJggg==";

async function buildTarget(target, manifestName) {
  const out = path.join(distDir, target);
  await mkdir(out, { recursive: true });
  await cp(buildDir, out, { recursive: true });
  await rewriteModuleImports(out);
  await copyStatic("popup", out);
  await copyStatic("sidepanel", out);
  await ensureIcons(path.join(out, "icons"));
  await copyFile(path.join(root, manifestName), path.join(out, "manifest.json"));
}

async function copyStatic(folder, out) {
  const source = path.join(root, "src", folder);
  const target = path.join(out, folder);
  await mkdir(target, { recursive: true });
  for (const entry of await readdir(source)) {
    if (entry.endsWith(".html") || entry.endsWith(".css")) {
      await copyFile(path.join(source, entry), path.join(target, entry));
    }
  }
}

async function ensureIcons(iconDir) {
  await mkdir(iconDir, { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    await writeFile(path.join(iconDir, `icon${size}.png`), pngDataUriToBuffer(placeholderPng));
  }
}

function pngDataUriToBuffer(dataUri) {
  return Buffer.from(dataUri.split(",", 2)[1], "base64");
}

async function rewriteModuleImports(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await rewriteModuleImports(fullPath);
      continue;
    }
    if (!entry.name.endsWith(".js")) continue;
    const source = await readFile(fullPath, "utf8");
    const rewritten = source.replace(
      /(from\s+["'])(\.\.?\/[^"']+?)(["'])/g,
      (_match, prefix, specifier, suffix) => `${prefix}${specifier.endsWith(".js") ? specifier : `${specifier}.js`}${suffix}`
    ).replace(
      /(import\s+["'])(\.\.?\/[^"']+?)(["'])/g,
      (_match, prefix, specifier, suffix) => `${prefix}${specifier.endsWith(".js") ? specifier : `${specifier}.js`}${suffix}`
    );
    if (rewritten !== source) await writeFile(fullPath, rewritten, "utf8");
  }
}

await rm(distDir, { recursive: true, force: true });
await buildTarget("chrome", "manifest.chrome.json");
await buildTarget("firefox", "manifest.firefox.json");
