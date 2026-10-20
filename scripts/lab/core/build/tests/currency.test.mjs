import assert from "node:assert/strict";
import test from "node:test";
import { coreBuildCurrency } from "../index.mjs";

const answers = (byStep) => {
  const asked = [];
  const decide = async (step, options) => {
    asked.push({ step, options });
    return byStep[step] ?? { decision: "reuse", reason: "inputs and outputs match the stamp" };
  };
  return { asked, decide };
};

test("a Core whose every library build its cache would reuse is current", async () => {
  const { asked, decide } = answers({});
  const verdict = await coreBuildCurrency("C:/core", { decide, env: {} });
  assert.deepEqual(verdict, { stale: false, steps: [], message: null });
  assert.deepEqual(asked.map((item) => item.step), ["contracts:build", "fluxiq:build", "client-gateway-websocket:build"]);
  assert.ok(asked.every((item) => item.options.repoRoot === "C:/core"));
});

test("a library its cache would rebuild is stale, named with Core's own reason", async () => {
  const { decide } = answers({ "fluxiq:build": { decision: "build", reason: "inputs changed: packages/fluxiq/package.json" } });
  const verdict = await coreBuildCurrency("C:/core", { decide, env: {} });
  assert.equal(verdict.stale, true);
  assert.deepEqual(verdict.steps, [{ step: "fluxiq:build", reason: "inputs changed: packages/fluxiq/package.json" }]);
  assert.ok(verdict.message.includes("fluxiq:build (inputs changed: packages/fluxiq/package.json)"), verdict.message);
  assert.ok(verdict.message.includes("C:/core"), verdict.message);
});

test("a forced rebuild in the caller's environment is not mistaken for a stale build", async () => {
  const { asked, decide } = answers({});
  await coreBuildCurrency("C:/core", { decide, env: { FLUXIQ_BUILD_FORCE: "1", KEEP: "yes" } });
  assert.ok(asked.every((item) => !("FLUXIQ_BUILD_FORCE" in item.options.env) && item.options.env.KEEP === "yes"));
});

test("a Core without the build cache entry is refused by name", async () => {
  await assert.rejects(coreBuildCurrency("C:/no/such/core", { env: {} }), /build cache could not be loaded from .*scripts.build-cache.index\.mjs/u);
});
