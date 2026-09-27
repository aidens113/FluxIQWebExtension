import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "@playwright/test";
import { persistedFlowRunContext } from "../persisted-flow-run-context.js";

const page = (url: string) => ({ url: () => url }) as unknown as Page;

test("a persisted Flow is run with this run's scenario, origin, page, seed and facility run id", () => {
  assert.deepEqual(
    persistedFlowRunContext({ scenario: { id: "auth-gate" }, scenarioOrigin: "http://127.0.0.1:4100", page: page("http://127.0.0.1:4100/scenarios/auth-gate/account"), seed: 7, facilityRunId: "run-abc" }),
    { scenarioId: "auth-gate", scenarioOrigin: "http://127.0.0.1:4100", scenarioUrl: "http://127.0.0.1:4100/scenarios/auth-gate/account", seed: 7, facilityRunId: "run-abc" },
  );
});

/**
 * The page the Flow is about to run against, not the one the run opened on. A
 * context built once at the top of a run and reused would have told Core the
 * entry point while the browser had navigated on.
 */
test("the page URL is read at the moment of the call", () => {
  let current = "http://127.0.0.1:4100/scenarios/auth-gate/";
  const moving = { url: () => current } as unknown as Page;
  const input = { scenario: { id: "auth-gate" }, scenarioOrigin: "http://127.0.0.1:4100", page: moving, seed: 1, facilityRunId: "run-abc" };
  assert.equal(persistedFlowRunContext(input).scenarioUrl, "http://127.0.0.1:4100/scenarios/auth-gate/");
  current = "http://127.0.0.1:4100/scenarios/auth-gate/account";
  assert.equal(persistedFlowRunContext(input).scenarioUrl, "http://127.0.0.1:4100/scenarios/auth-gate/account");
});

test("nothing else reaches the Flow's inputs", () => {
  const context = persistedFlowRunContext({ scenario: { id: "auth-gate" }, scenarioOrigin: "http://127.0.0.1:4100", page: page("http://127.0.0.1:4100/"), seed: 0, facilityRunId: "run-abc" });
  assert.deepEqual(Object.keys(context).sort(), ["facilityRunId", "scenarioId", "scenarioOrigin", "scenarioUrl", "seed"]);
});
