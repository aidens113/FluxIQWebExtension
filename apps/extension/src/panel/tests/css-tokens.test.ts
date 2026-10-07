import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Every `var(--name)` the panel's stylesheets read names a custom property one
// of them defines, or gives its own fallback. An undefined one makes the whole
// declaration invalid, silently: the chat's Stop control read
// `border: 1px solid var(--border)`, `--border` was never defined, so the
// button drew no border and, white on the white dock, read as plain text (D9
// of the t342 round 2 UI review, run-muylu4pp-f9cb2121). The stylesheets type-
// check and bundle either way, so the source is scanned.

function panelRoot(): string {
  // The test runs from a bundle under `.test-build-scratch/<label>/`, so the
  // package is found by walking up to its manifest rather than by a fixed depth.
  let directory = path.dirname(fileURLToPath(import.meta.url));
  while (!existsSync(path.join(directory, "manifest.chrome.json"))) {
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error("apps/extension (manifest.chrome.json) not found above the test bundle");
    directory = parent;
  }
  return path.join(directory, "src", "panel");
}

function stylesheets(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...stylesheets(full));
    else if (entry.name.endsWith(".css")) found.push(full);
  }
  return found;
}

test("every custom property the panel's stylesheets read is defined, or has a fallback", () => {
  const sheets = stylesheets(panelRoot()).map((file) => ({ file, text: readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "") }));
  assert.ok(sheets.length > 3, "the panel's stylesheets were found");
  const defined = new Set(sheets.flatMap(({ text }) => [...text.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]!)));
  const undefinedReads = sheets.flatMap(({ file, text }) => [...text.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)]
    .filter((match) => !defined.has(match[1]!))
    .map((match) => `${path.basename(file)}: ${match[0]}`));
  assert.deepEqual(undefinedReads, []);
});
