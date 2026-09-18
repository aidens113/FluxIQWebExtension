import assert from "node:assert/strict";
import test from "node:test";

import { coreBuildStaleness } from "../core-build-stale.mjs";

test("a build newer than its source is not stale", () => {
  const verdict = coreBuildStaleness({ newestMs: 1_000, newestPath: "src/a.ts" }, { newestMs: 2_000, newestPath: "dist/a.js" });
  assert.equal(verdict.stale, false);
  assert.equal(verdict.message, null);
});

test("a source newer than the build is stale, and the message names both files", () => {
  // The message is the point. "Stale" alone gets rerun and fails again; naming
  // the newer source and the newest built file gets the right thing rebuilt.
  const verdict = coreBuildStaleness({ newestMs: 11 * 60_000, newestPath: "src/llm/limits.ts" }, { newestMs: 60_000, newestPath: "dist/llm/limits.js" });
  assert.equal(verdict.stale, true);
  assert.match(verdict.message, /src\/llm\/limits\.ts/u);
  assert.match(verdict.message, /dist\/llm\/limits\.js/u);
  assert.match(verdict.message, /COMPILED/u);
});

test("nothing built and nothing found are both reported as not stale", () => {
  // Saying "stale" for a Core that was never built, or never found, sends
  // someone rebuilding what was not the problem; both are already reported by
  // the callers that care about them.
  assert.equal(coreBuildStaleness({ newestMs: 5, newestPath: "src/a.ts" }, { newestMs: 0, newestPath: null }).stale, false);
  assert.equal(coreBuildStaleness({ newestMs: 0, newestPath: null }, { newestMs: 5, newestPath: "dist/a.js" }).stale, false);
});

test("a build behind by under a minute still refuses, and says so readably", () => {
  const verdict = coreBuildStaleness({ newestMs: 30_000, newestPath: "src/a.ts" }, { newestMs: 1_000, newestPath: "dist/a.js" });
  assert.equal(verdict.stale, true);
  assert.match(verdict.message, /less than a minute/u);
});

test("a Core test file is not a source the build ships, so it cannot make a build stale", async () => {
  // Otherwise touching any Core test blocks every campaign, which is precisely
  // what happens while somebody is fixing assertions beside a running one.
  const { mkdtemp, mkdir, writeFile } = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const { scanCoreSources } = await import("../core-build-staleness.mjs");

  const root = await mkdtemp(path.join(os.tmpdir(), "core-src-"));
  await mkdir(path.join(root, "packages", "fluxiq", "src", "tests"), { recursive: true });
  await writeFile(path.join(root, "packages", "fluxiq", "src", "shipped.ts"), "export const a = 1;\n");
  await writeFile(path.join(root, "packages", "fluxiq", "src", "beside.test.ts"), "// not shipped\n");
  await writeFile(path.join(root, "packages", "fluxiq", "src", "tests", "inside.ts"), "// not shipped\n");

  const scan = await scanCoreSources(root);
  assert.match(scan.newestPath ?? "", /shipped\.ts$/u);
});
