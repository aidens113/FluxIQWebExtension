import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { delayedUiScenario as scenario } from "../scenario.js";

const context = { runToken: "unit-test-run-token-0001", seed: 107 };

/** The delay the rendered page schedules its reveal with. */
function renderedDelayMs(mode: "baseline" | "too-slow"): number {
  const state = mode === "baseline" ? scenario.createState(107) : scenario.mutate(scenario.createState(107), "set-mode", { mode });
  const match = /\}, (\d+)\)\);/u.exec(scenario.render(state, context));
  assert.ok(match, `the ${mode} rendering schedules no reveal`);
  return Number(match[1]);
}

test("the manifest is valid and resolves its primary workflow and too-slow variant", () => {
  const result = validateWebScenario(scenario.manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual(scenario.manifest.variants?.map(({ id }) => id), ["too-slow"]);

  const primary = resolveScenarioWorkflow(scenario.manifest);
  assert.equal(primary.expected.failure, undefined);
  assert.equal(primary.recordingScript.find(({ id }) => id === "await-late-action")?.timeoutMs, 1000);

  const slow = resolveScenarioWorkflow(scenario.manifest, { variantId: "too-slow" });
  assert.deepEqual(slow.variant?.arm, { operation: "set-mode", payload: { mode: "too-slow" } });
  assert.deepEqual(slow.expected.failure, { category: "timeout", code: "web.action.timeout" });
  assert.deepEqual(slow.expected.finalState, [{ id: "late-action-absent", subject: "late-action", predicate: "exists", value: false }]);
  assert.deepEqual(slow.recordingScript, primary.recordingScript);
});

test("state is deterministic from the seed and arming clears the recording's reveal", () => {
  assert.deepEqual(scenario.createState(107), scenario.createState(107));
  assert.deepEqual(scenario.createState(107), { revealed: false, delayMs: 150 }, "the unarmed oracle shape is unchanged by the variant");
  const revealed = scenario.mutate(scenario.createState(107), "reveal", {});
  assert.equal(revealed.revealed, true);
  assert.deepEqual(scenario.mutate(revealed, "set-mode", { mode: "too-slow" }), { revealed: false, delayMs: 150, mode: "too-slow" });
  for (const invalid of [{ mode: "quick" }, {}, null]) {
    assert.equal(scenario.mutate(revealed, "set-mode", invalid), revealed, JSON.stringify(invalid));
  }
});

test("too-slow is the same page, later: only the reveal delay changes, and it outlasts every wait involved", () => {
  const baseline = renderedDelayMs("baseline");
  const slow = renderedDelayMs("too-slow");
  assert.equal(baseline, 150);
  assert.equal(slow, 20_000);
  // Past the recorded 1,000 ms wait and past the content script's 10,000 ms
  // default, so neither can be satisfied by waiting longer.
  assert.ok(slow > 10_000, `${slow} must outlast DEFAULT_WAIT_TIMEOUT_MS`);
  // The content still arrives: nothing here reports slowness or refuses to render.
  const armedPage = scenario.render(scenario.mutate(scenario.createState(107), "set-mode", { mode: "too-slow" }), context);
  const baselinePage = scenario.render(scenario.createState(107), context);
  assert.equal(armedPage.replace("20000", "150"), baselinePage);
});
