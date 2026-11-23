import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the scoreboard launcher consumes an actual exported runner subpath", async () => {
  const metadata = JSON.parse(await readFile(new URL("../../../../package.json", import.meta.url), "utf8"));
  assert.equal(metadata.exports["./offline-scoreboard"], "./dist/attempt-lane/scoreboard/index.js");
  const name = "@fluxiq-web-extension/test-runner/offline-scoreboard";
  const loaded = await import(name);
  assert.equal(typeof loaded.collectOfflineScoreboard, "function");
  assert.equal(loaded.OFFLINE_SCOREBOARD_TASKS.length, 10);
});
