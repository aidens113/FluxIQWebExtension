// The bounds a build's published accounting has to satisfy. They exist because
// a record that does not add up is not accounting, and a reader that takes it
// anyway reports arithmetic nobody can defend.

import assert from "node:assert/strict";
import test from "node:test";
import { adaptationEvidenceLoop } from "../adaptation-evidence-loop.js";

const loop = (extra: Record<string, unknown> = {}) => ({
  evidenceGuided: true,
  providerCallCount: 17,
  decisionCount: 17,
  traceStepCount: 18,
  iterationCount: 18,
  toolCallCount: 9,
  evidenceBytes: 18_000,
  toolIds: ["web.recovery.inspect"],
  ...extra,
});

test("a build that is not evidence-guided publishes no loop accounting", () => {
  assert.equal(adaptationEvidenceLoop({ providerCallCount: 4 }, "detail"), undefined);
  assert.equal(adaptationEvidenceLoop(undefined, "detail"), undefined);
});

test("the calls made outside the loop are kept beside the loop's own, and their total", () => {
  const read = adaptationEvidenceLoop(loop({ additionalProviderCallCount: 1, totalProviderCallCount: 18 }), "detail");

  assert.equal(read?.providerCallCount, 17);
  assert.equal(read?.additionalProviderCallCount, 1);
  assert.equal(read?.totalProviderCallCount, 18);
});

test("a total that is not the loop's calls plus the ones outside it is refused", () => {
  assert.throws(() => adaptationEvidenceLoop(loop({ additionalProviderCallCount: 1, totalProviderCallCount: 20 }), "detail"), /exceeded its bounded contract/u);
});

test("an extra-call count with no total to belong to is refused, because nothing says what it is part of", () => {
  assert.throws(() => adaptationEvidenceLoop(loop({ additionalProviderCallCount: 1 }), "detail"), /exceeded its bounded contract/u);
});

test("a total past the run's own call ceiling is refused: one grant paid for all of them", () => {
  assert.throws(() => adaptationEvidenceLoop(loop({ providerCallCount: 60, decisionCount: 60, iterationCount: 61, traceStepCount: 61, additionalProviderCallCount: 40, totalProviderCallCount: 100 }), "detail"), /exceeded its bounded contract/u);
});

test("a build that made only loop calls still reads, and says nothing about calls outside it", () => {
  const read = adaptationEvidenceLoop(loop(), "detail");

  assert.equal(read?.totalProviderCallCount, undefined);
  assert.equal(read?.additionalProviderCallCount, undefined);
  assert.equal(read?.decisionCount, 17);
});

// A decision that edits the draft and re-runs a step writes two rows under one
// iteration, so a build's rows sit above its decisions. This held them equal,
// which was only ever true while Core counted rows as decisions -- and the
// moment Core started counting calls correctly, every build that had corrected
// itself would have been rejected here as malformed.
test("more trace rows than iterations is a build that corrected itself, not a malformed record", () => {
  const read = adaptationEvidenceLoop(loop({ providerCallCount: 16, decisionCount: 16, iterationCount: 17, traceStepCount: 21 }), "detail");

  assert.equal(read?.providerCallCount, 16);
  assert.equal(read?.traceStepCount, 21);
  assert.equal(read?.iterationCount, 17);
});

test("fewer trace rows than iterations is refused: every iteration wrote at least one", () => {
  assert.throws(() => adaptationEvidenceLoop(loop({ traceStepCount: 17, iterationCount: 18 }), "detail"), /exceeded its bounded contract/u);
});

test("more rows than two per decision is refused, and exactly two per decision is not", () => {
  assert.equal(adaptationEvidenceLoop(loop({ providerCallCount: 64, decisionCount: 64, iterationCount: 65, traceStepCount: 129 }), "detail")?.traceStepCount, 129);
  assert.throws(() => adaptationEvidenceLoop(loop({ providerCallCount: 64, decisionCount: 64, iterationCount: 65, traceStepCount: 130 }), "detail"), /exceeded its bounded contract/u);
});

test("a build publishes one step per trace row, so its steps are bounded by the rows", () => {
  const steps = (count: number) => Array.from({ length: count }, () => ({ toolId: "core.run_node" }));

  assert.equal(adaptationEvidenceLoop(loop({ steps: steps(100) }), "detail")?.steps?.length, 100);
  assert.throws(() => adaptationEvidenceLoop(loop({ steps: steps(130) }), "detail"), /exceeded its bounded contract/u);
});

// A row used to be rebuilt as exactly `toolId`, `effectApplied` and
// `resultCode`, so every other member Core published was thrown away here --
// before it could reach the record a run publishes. What replaced the
// whitelist is the shape of each value, and these two tests are the pair that
// matters: everything Core sends arrives, and nothing that could carry the
// page does.

test("a decision row carries every member Core published on it", () => {
  const read = adaptationEvidenceLoop(loop({
    steps: [{
      toolId: "core.run_node",
      effectApplied: true,
      resultCode: "web.action.succeeded",
      iteration: 7,
      callId: "call-01J9F4Z2",
      evidenceBytes: 4_096,
      reason: "web.action.rejected.target_unobserved",
      startedAt: "2026-09-24T11:04:07+00:00",
      usage: { inputTokens: 1_200, outputTokens: 300, totalTokens: 1_500 },
    }],
  }), "detail");

  assert.deepEqual(read?.steps?.[0], {
    toolId: "core.run_node",
    effectApplied: true,
    resultCode: "web.action.succeeded",
    iteration: 7,
    callId: "call-01J9F4Z2",
    evidenceBytes: 4_096,
    reason: "web.action.rejected.target_unobserved",
    startedAt: "2026-09-24T11:04:07+00:00",
    usage: { inputTokens: 1_200, outputTokens: 300, totalTokens: 1_500 },
  });
});

test("nothing the tool returned and nothing the model wrote reaches the record", () => {
  const read = adaptationEvidenceLoop(loop({
    steps: [{
      toolId: "core.run_node",
      iteration: 3,
      selector: '[data-testid="product-card"]',
      url: "http://127.0.0.1:53017/scenarios/catalog",
      label: "Add to cart",
      reply: "I will click the Submit button next",
      input: { selector: { nested: "deep" } },
    }],
  }), "detail");

  assert.deepEqual(read?.steps?.[0], { toolId: "core.run_node", iteration: 3 });
});
