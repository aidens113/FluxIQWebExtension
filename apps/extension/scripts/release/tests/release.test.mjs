import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { compareBuildInfo, hashBuildInputs, writeBuildInfo } from "../build-info.mjs";
import { renderIconPng } from "../icon-png.mjs";
import { REVIEWED_PERMISSIONS } from "../permission-review.mjs";
import { verifyExtensionTarget } from "../verify-extension-target.mjs";
import { readZip, writeZip } from "../zip-archive.mjs";

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("a ZIP round-trips every entry byte for byte and is reproducible", () => {
  const entries = [
    { name: "manifest.json", data: Buffer.from("{\"a\":1}") },
    { name: "background/index.js", data: Buffer.from("x".repeat(5000)) },
    { name: "icons/icon16.png", data: renderIconPng(16) }
  ];
  const archive = writeZip(entries);
  assert.deepEqual(writeZip([...entries].reverse()), archive, "entry order does not change the bytes");
  const read = new Map(readZip(archive).map((entry) => [entry.name, entry.data]));
  assert.equal(read.size, 3);
  for (const { name, data } of entries) assert.deepEqual(read.get(name), data);
});

test("a ZIP refuses entry names that escape the archive root", () => {
  for (const name of ["../x", "/abs", "a\\b", ""]) assert.throws(() => writeZip([{ name, data: Buffer.alloc(1) }]));
});

test("each icon is a PNG of exactly its size", () => {
  for (const size of [16, 32, 48, 128]) {
    const png = renderIconPng(size);
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
});

test("the build stamp is current until an input changes, then names it", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "fluxiq-build-info-"));
  try {
    const source = path.join(root, "src.ts");
    await writeFile(source, "one");
    const target = path.join(root, "dist");
    await writeFile(path.join(root, "unused.ts"), "never read");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(target));
    await writeBuildInfo(target, { target: "chrome", version: "1.0.0", inputs: await hashBuildInputs(root, [source]) });
    assert.deepEqual(await compareBuildInfo(target, root), { state: "current" });
    await writeFile(path.join(root, "unused.ts"), "edited");
    assert.deepEqual(await compareBuildInfo(target, root), { state: "current" }, "a file the bundle never read does not make it stale");
    await writeFile(source, "two");
    assert.deepEqual(await compareBuildInfo(target, root), { state: "stale", changed: ["src.ts"], removed: [] });
    await rm(source);
    assert.deepEqual(await compareBuildInfo(target, root), { state: "stale", changed: [], removed: ["src.ts"] });
    assert.equal((await compareBuildInfo(root, root)).state, "unstamped");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/** A minimal target that passes, built from the real store manifests. */
async function targetFiles(manifestName, edit = (manifest) => manifest) {
  const manifest = edit(JSON.parse(await readFile(path.join(extensionRoot, manifestName), "utf8")));
  const files = new Map([["manifest.json", Buffer.from(JSON.stringify(manifest))]]);
  for (const size of [16, 32, 48, 128]) files.set(`icons/icon${size}.png`, renderIconPng(size));
  files.set("background/index.js", Buffer.from("import './x.js'; export {};"));
  files.set("background/x.js", Buffer.from("export const x = 1;"));
  files.set("content/index.js", Buffer.from("(() => {})();"));
  files.set("page-world/index.js", Buffer.from("(() => {})();"));
  for (const page of ["popup", "sidepanel"]) {
    files.set(`${page}/index.html`, Buffer.from('<div id="app"></div><link rel="stylesheet" href="./index.css"><script type="module" src="./index.js"></script>'));
    files.set(`${page}/index.css`, Buffer.from("body{}"));
    files.set(`${page}/index.js`, Buffer.from("export {};"));
  }
  return { files, version: manifest.version };
}

test("the shipped Chrome and Firefox manifests verify", async () => {
  for (const [target, manifestName] of [["chrome", "manifest.chrome.json"], ["firefox", "manifest.firefox.json"], ["e2e-chromium", "manifest.e2e.json"]]) {
    const { files, version } = await targetFiles(manifestName);
    const { errors } = await verifyExtensionTarget({ target, files, expectedVersion: version });
    assert.deepEqual(errors, [], `${target}: ${errors.join("; ")}`);
  }
});

test("verification names each defect a browser or store would refuse", async () => {
  const cases = [
    ["firefox", "manifest.firefox.json", (m) => ({ ...m, browser_specific_settings: { gecko: { ...m.browser_specific_settings.gecko, strict_min_version: "109.0" } } }), /world MAIN/],
    ["firefox", "manifest.firefox.json", (m) => ({ ...m, permissions: [...m.permissions, "sidePanel"] }), /no side panel/],
    ["chrome", "manifest.chrome.json", (m) => ({ ...m, permissions: [...m.permissions, "cookies"] }), /"cookies", which is not in scripts\/release\/permission-review/],
    ["chrome", "manifest.chrome.json", (m) => ({ ...m, content_scripts: [{ matches: ["<all_urls>"], js: ["missing.js"] }] }), /names missing\.js/],
    ["chrome", "manifest.chrome.json", (m) => ({ ...m, icons: { ...m.icons, 48: "icons/icon16.png" } }), /16x16 but is declared as 48x48/],
    ["chrome", "manifest.chrome.json", (m) => { const { minimum_chrome_version: _dropped, ...rest } = m; return rest; }, /minimum_chrome_version/]
  ];
  for (const [target, manifestName, edit, expected] of cases) {
    const { files, version } = await targetFiles(manifestName, edit);
    const { errors } = await verifyExtensionTarget({ target, files, expectedVersion: version });
    assert.ok(errors.some((error) => expected.test(error)), `${target}: expected ${expected} in ${JSON.stringify(errors)}`);
  }
});

test("verification refuses a version drift, a broken script and store-only leftovers", async () => {
  const { files, version } = await targetFiles("manifest.chrome.json");
  files.set("content/index.js", Buffer.from("function ("));
  files.set("content/index.js.map", Buffer.from("{}"));
  const { errors } = await verifyExtensionTarget({ target: "chrome", files, expectedVersion: `${version}.1`, store: true });
  assert.ok(errors.some((error) => /does not match apps\/extension\/package\.json/.test(error)));
  assert.ok(errors.some((error) => /content\/index\.js does not parse/.test(error)));
  assert.ok(errors.some((error) => /must not contain content\/index\.js\.map/.test(error)));
});

test("the placeholder Firefox id warns in a build and fails a release", async () => {
  const { files, version } = await targetFiles("manifest.firefox.json");
  const build = await verifyExtensionTarget({ target: "firefox", files, expectedVersion: version });
  assert.ok(build.warnings.some((warning) => /placeholder/.test(warning)));
  const release = await verifyExtensionTarget({ target: "firefox", files, expectedVersion: version, release: true });
  assert.ok(release.errors.some((error) => /placeholder/.test(error)));
});

test("every reviewed permission carries its reason and use site", () => {
  for (const entry of REVIEWED_PERMISSIONS) {
    assert.ok(entry.why.length > 40, entry.permission);
    assert.ok(entry.usedBy.length > 0, entry.permission);
    assert.ok(entry.targets.length > 0, entry.permission);
  }
});
