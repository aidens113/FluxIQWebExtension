import assert from "node:assert/strict";
import test from "node:test";

import { CORE_REBUILD_COMMAND, coreBuildFreshness } from "../index.mjs";

const built = async (coreRoot) => ({ coreRoot, packagesFound: true, installed: true, packages: [{ name: "fluxiq", directory: "packages/fluxiq", expected: ["./dist/index.js"], missing: [] }] });
const unbuilt = async (coreRoot) => ({ coreRoot, packagesFound: true, installed: true, packages: [{ name: "fluxiq", directory: "packages/fluxiq", expected: ["./dist/index.js"], missing: ["./dist/index.js"] }] });
const current = async () => ({ stale: false, steps: [], message: null });
const staleBecause = (step, reason) => async () => ({ stale: true, steps: [{ step, reason }], message: `would rebuild ${step}` });

test("a Core whose build cache would reuse every library build is fresh", async () => {
  const verdict = await coreBuildFreshness("C:/core", { entries: built, currency: current });
  assert.deepEqual(verdict, { fresh: true, message: null });
});

test("a Core its build cache would rebuild is refused, naming the step, Core's reason and the rebuild command", async () => {
  const verdict = await coreBuildFreshness("C:/core", { entries: built, currency: staleBecause("fluxiq:build", "inputs changed: packages/fluxiq") });
  assert.equal(verdict.fresh, false);
  assert.ok(verdict.message.includes("fluxiq:build: inputs changed: packages/fluxiq"), verdict.message);
  assert.ok(verdict.message.includes("C:/core"), verdict.message);
  assert.ok(verdict.message.includes(CORE_REBUILD_COMMAND), "names the rebuild command");
});

test("the caller's environment is what the build cache is asked with", async () => {
  let seen = null;
  await coreBuildFreshness("C:/core", { entries: built, currency: async (_root, options) => {
    seen = options.env;
    return { stale: false, steps: [], message: null };
  } }, { env: { MARK: "1" } });
  assert.deepEqual(seen, { MARK: "1" });
});

test("a refusal names the command it refused, so a build or test is not told to rerun pnpm check", async () => {
  const gate = "pnpm --filter @fluxiq-web-extension/domain build";
  const stale = await coreBuildFreshness("C:/core", { entries: built, currency: staleBecause("fluxiq:build", "no stamp") }, { gate });
  assert.ok(stale.message.startsWith(`${gate}: `), stale.message);
  assert.ok(stale.message.includes(`then run ${gate} again`), stale.message);
  assert.ok(!stale.message.includes("pnpm check"), stale.message);
  const missing = await coreBuildFreshness("C:/core", { entries: unbuilt, currency: current }, { gate });
  assert.ok(missing.message.startsWith(`${gate}: `), missing.message);
});

test("the rebuild command builds Core's libraries in order", () => {
  assert.equal(CORE_REBUILD_COMMAND, "pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build");
});

test("a Core that was never built is refused before its build cache is asked", async () => {
  let asked = false;
  const verdict = await coreBuildFreshness("C:/core", { entries: unbuilt, currency: async () => {
    asked = true;
    return { stale: false, steps: [], message: null };
  } });
  assert.equal(verdict.fresh, false);
  assert.equal(asked, false);
  assert.match(verdict.message, /has not been built/u);
});
