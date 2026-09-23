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
