import assert from "node:assert/strict";
import test from "node:test";

import { CORE_REBUILD_COMMAND, coreBuildFreshness } from "../index.mjs";

const built = async (coreRoot) => ({ coreRoot, packagesFound: true, installed: true, packages: [{ name: "fluxiq", directory: "packages/fluxiq", expected: ["./dist/index.js"], missing: [] }] });
const unbuilt = async (coreRoot) => ({ coreRoot, packagesFound: true, installed: true, packages: [{ name: "fluxiq", directory: "packages/fluxiq", expected: ["./dist/index.js"], missing: ["./dist/index.js"] }] });
const at = (newestMs, newestPath) => async () => ({ newestMs, newestPath });

test("a Core built after its newest source is fresh", async () => {
  const verdict = await coreBuildFreshness("C:/core", { entries: built, sources: at(1_000, "src/a.ts"), output: at(2_000, "dist/a.js") });
  assert.deepEqual(verdict, { fresh: true, message: null });
});

test("a Core source newer than its build is refused, naming the stale file and the rebuild command", async () => {
  const stale = "C:/core/packages/fluxiq/src/programs/automation-studio/runtime/parking/person-needed-tool-calls.ts";
  const verdict = await coreBuildFreshness("C:/core", { entries: built, sources: at(10 * 60_000, stale), output: at(60_000, "C:/core/packages/fluxiq/dist/index.js") });
  assert.equal(verdict.fresh, false);
  assert.ok(verdict.message.includes(stale), "names the stale source");
  assert.ok(verdict.message.includes("C:/core/packages/fluxiq/dist/index.js"), "names the newest built file");
  assert.match(verdict.message, /9 minute\(s\) behind/u);
  assert.ok(verdict.message.includes(CORE_REBUILD_COMMAND), "names the rebuild command");
});

test("the rebuild command builds Core's libraries in order", () => {
  assert.equal(CORE_REBUILD_COMMAND, "pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build");
});

test("a Core that was never built is refused before staleness is asked", async () => {
  let asked = false;
  const verdict = await coreBuildFreshness("C:/core", { entries: unbuilt, sources: async () => { asked = true; return { newestMs: 0, newestPath: null }; }, output: at(0, null) });
  assert.equal(verdict.fresh, false);
  assert.equal(asked, false);
  assert.match(verdict.message, /has not been built/u);
});
