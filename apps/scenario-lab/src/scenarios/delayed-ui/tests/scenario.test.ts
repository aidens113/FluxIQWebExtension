import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { delayedUiScenario as scenario } from "../scenario.js";

const context = { runToken: "unit-test-run-token-0001", seed: 107 };

/** The delay the rendered page schedules its reveal with. */
function renderedDelayMs(mode: "baseline" | "too-slow" | "late-recoverable"): number {
  const state = mode === "baseline" ? scenario.createState(107) : scenario.mutate(scenario.createState(107), "set-mode", { mode });
  const match = /\}, (\d+)\)\);/u.exec(scenario.render(state, context));
  assert.ok(match, `the ${mode} rendering schedules no reveal`);
  return Number(match[1]);
}

test("the manifest is valid and resolves its primary workflow and both late variants", () => {
  const result = validateWebScenario(scenario.manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual(scenario.manifest.variants?.map(({ id }) => id), ["late-recoverable", "too-slow"]);

  const primary = resolveScenarioWorkflow(scenario.manifest);
  assert.equal(primary.expected.failure, undefined);
  assert.equal(primary.recordingScript.find(({ id }) => id === "await-late-action")?.timeoutMs, 1000);

  const slow = resolveScenarioWorkflow(scenario.manifest, { variantId: "too-slow" });
  assert.deepEqual(slow.variant?.arm, { operation: "set-mode", payload: { mode: "too-slow" } });
  assert.deepEqual(slow.expected.failure, { category: "timeout", code: "web.action.timeout" });
  assert.deepEqual(slow.expected.finalState, [{ id: "late-action-absent", subject: "late-action", predicate: "exists", value: false }]);
  assert.deepEqual(slow.recordingScript, primary.recordingScript);

  const late = resolveScenarioWorkflow(scenario.manifest, { variantId: "late-recoverable" });
  assert.deepEqual(late.variant?.arm, { operation: "set-mode", payload: { mode: "late-recoverable" } });
  // It is the absorbable one, so it declares no failure and inherits none: the
  // run is expected to finish, having paid two attempts at the wait for it.
  assert.equal(late.expected.failure, undefined);
  assert.deepEqual(late.expected.recovery, {
    absorbedBy: "retry_node",
    because: "A wait that ran out fails as web.action.timeout, which the domain marks retryable, so the ladder's retry rung attempts the node again and the content has arrived by then.",
    maxAttemptsPerNode: 2,
  });
  assert.equal(late.expected.providerCalls?.count, 0);
  assert.deepEqual(late.recordingScript, primary.recordingScript);
});

test("the two late variants sit either side of the runtime's reach, and the arithmetic says which is which", () => {
  // A replayed wait is given its Flow node's default 5,000 ms whatever the
  // recording asked for, and Core retries a failed node three times with
  // 250 ms, 1 s and 2 s of backoff. So the second attempt at the wait ends
  // 10,250 ms after the first was dispatched, and the third 16,250 ms after.
  const replayedWaitMs = 5_000;
  const secondAttemptEndsMs = replayedWaitMs + 250 + replayedWaitMs;
  const lastAttemptEndsMs = secondAttemptEndsMs + 1_000 + replayedWaitMs;

  const late = renderedDelayMs("late-recoverable");
  const slow = renderedDelayMs("too-slow");
  // Past the first attempt, so the first one always runs out...
  assert.ok(late > replayedWaitMs, `${late} must outlast one replayed wait`);
  // ...and inside the second, with room for the gap between the click that
  // starts the delay and the wait's own dispatch.
  assert.ok(late <= secondAttemptEndsMs, `${late} must be caught by the second attempt, which ends at ${secondAttemptEndsMs}`);
  // And too-slow is past every attempt there is, which is why nothing absorbs it.
  assert.ok(slow > lastAttemptEndsMs, `${slow} must outlast the whole ladder, which ends at ${lastAttemptEndsMs}`);
});

test("both recorded clicks are pinned, so a Flow proposal that lost Load content is short of the recording", () => {
  const primary = resolveScenarioWorkflow(scenario.manifest);
  assert.deepEqual(primary.expected.recordingEvents, [{ type: "web.element.clicked", count: 2 }, { type: "web.dom.mutated" }]);
  const scriptedClicks = primary.recordingScript.filter(({ operation }) => operation === "click").length;
  assert.equal(primary.expected.recordingEvents?.find(({ type }) => type === "web.element.clicked")?.count, scriptedClicks);
  // too-slow runs only on the Flow lane, against the unarmed recording, so it inherits the pin.
  assert.deepEqual(resolveScenarioWorkflow(scenario.manifest, { variantId: "too-slow" }).expected.recordingEvents, primary.expected.recordingEvents);
});

test("state is deterministic from the seed and arming clears the recording's reveal", () => {
  assert.deepEqual(scenario.createState(107), scenario.createState(107));
  assert.deepEqual(scenario.createState(107), { revealed: false, delayMs: 150 }, "the unarmed oracle shape is unchanged by the variants");
  const revealed = scenario.mutate(scenario.createState(107), "reveal", {});
  assert.equal(revealed.revealed, true);
  assert.deepEqual(scenario.mutate(revealed, "set-mode", { mode: "too-slow" }), { revealed: false, delayMs: 150, mode: "too-slow" });
  assert.deepEqual(scenario.mutate(revealed, "set-mode", { mode: "late-recoverable" }), { revealed: false, delayMs: 150, mode: "late-recoverable" });
  for (const invalid of [{ mode: "quick" }, {}, null]) {
    assert.equal(scenario.mutate(revealed, "set-mode", invalid), revealed, JSON.stringify(invalid));
  }
});

test("too-slow is the same page, later: only the reveal delay changes, and it outlasts every wait involved", () => {
  const baseline = renderedDelayMs("baseline");
  const slow = renderedDelayMs("too-slow");
  assert.equal(baseline, 150);
  assert.equal(slow, 45_000);
  assert.equal(renderedDelayMs("late-recoverable"), 9_500);
  // Past the recorded 1,000 ms wait and past the content script's 10,000 ms
  // default, so neither can be satisfied by waiting longer.
  assert.ok(slow > 10_000, `${slow} must outlast DEFAULT_WAIT_TIMEOUT_MS`);
  // The content still arrives: nothing here reports slowness or refuses to render.
  const armedPage = scenario.render(scenario.mutate(scenario.createState(107), "set-mode", { mode: "too-slow" }), context);
  const baselinePage = scenario.render(scenario.createState(107), context);
  assert.equal(armedPage.replace("45000", "150"), baselinePage);
});
