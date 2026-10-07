// Structural: every Chromium this package launches on a profile directory
// forgets that profile's stored service workers first. A persistent profile
// otherwise keeps running the extension's first background worker whatever
// build is on disk (`../forget-cached-service-workers.ts`), which is what made
// live run `run-muxky0df-c9839389` refuse every Next page. This reads the
// sources, so a new launch site fails the build until it does the same.

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

// Compiled to dist/guarded-browser/tests/, three levels below the package root.
const sourceRoot = path.resolve(import.meta.dirname, "..", "..", "..", "src");
/** A Chromium launched on a profile directory. */
const PERSISTENT_CHROMIUM = /\bchromium\s*\.\s*launchPersistentContext\s*\(/u;
/** Where the guarded launcher launches: its `launch` parameter defaults to the call above, and runs here. */
const GUARDED_LAUNCH = "await launch(userDataDir";
const FORGET = "forgetCachedServiceWorkers(";

function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/(^|[^:])\/\/.*$/gmu, "$1");
}

async function sourceFiles(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) { if (entry.name !== "tests") found.push(...await sourceFiles(full)); }
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) found.push(full);
  }
  return found;
}

test("every persistent Chromium launch forgets the profile's stored service workers before it launches", async () => {
  const launching: string[] = [];
  const unguarded: string[] = [];
  for (const file of await sourceFiles(sourceRoot)) {
    const text = code(await readFile(file, "utf8"));
    const launch = text.includes(GUARDED_LAUNCH) ? text.indexOf(GUARDED_LAUNCH) : text.search(PERSISTENT_CHROMIUM);
    if (launch < 0) continue;
    const relative = path.relative(sourceRoot, file).replaceAll("\\", "/");
    launching.push(relative);
    const forget = text.indexOf(FORGET);
    if (forget < 0 || forget > launch) unguarded.push(relative);
  }
  // The four launchers there are today; a fifth is checked the same way without being listed.
  for (const known of ["guarded-browser/launch-guarded-context.ts", "run-scenario/browser-session/launch-browser.ts", "interactive-session.ts", "saved-flow-replay/replay-browser.ts"]) {
    assert.ok(launching.includes(known), `${known} is found as a persistent Chromium launch`);
  }
  assert.deepEqual(unguarded, [], `These launch a persistent Chromium without forgetting its stored service workers first: ${unguarded.join(", ")}`);
});
