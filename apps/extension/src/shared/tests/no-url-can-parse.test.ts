import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// `URL.canParse` needs Chrome 120 and Firefox 115, and `manifest.chrome.json`
// admits Chrome 116 (`minimum_chrome_version`). On Chrome 116 to 119 the call
// throws, so every path through it fails. Parse with `shared/parsed-url.ts`
// instead. This scans the source rather than trusting review, because the call
// type-checks and passes every Node test.

function packageRoot(): string {
  // The test runs from a bundle under `.test-build-scratch/<label>/`, so the
  // package is found by walking up to its manifest rather than by a fixed depth.
  let directory = path.dirname(fileURLToPath(import.meta.url));
  while (!existsSync(path.join(directory, "manifest.chrome.json"))) {
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error("apps/extension (manifest.chrome.json) not found above the test bundle");
    directory = parent;
  }
  return directory;
}

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "tests") found.push(...sourceFiles(full));
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name) && !/\.test\.\w+$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

// Code only: a comment may name the API to say why it is not used.
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("no extension source calls URL.canParse, which the manifest minimums (Chrome 116) do not have", () => {
  const root = packageRoot();
  const manifest = JSON.parse(readFileSync(path.join(root, "manifest.chrome.json"), "utf8")) as { minimum_chrome_version?: string };
  const files = sourceFiles(path.join(root, "src"));
  assert.ok(files.length > 50, `expected the extension's source under ${root}/src, found ${files.length} files`);
  const offenders = files
    .filter((file) => /\bURL\s*\.\s*canParse\b/.test(withoutComments(readFileSync(file, "utf8"))))
    .map((file) => path.relative(root, file).split(path.sep).join("/"));
  assert.deepEqual(
    offenders,
    [],
    `URL.canParse needs Chrome 120 and Firefox 115; manifest.chrome.json admits Chrome ${manifest.minimum_chrome_version}. Use parsedUrl from src/shared/parsed-url.ts in: ${offenders.join(", ")}`
  );
});
