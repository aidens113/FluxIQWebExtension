import assert from "node:assert/strict";
import test from "node:test";
import { hostProofContinuation } from "../continuation.js";

test("a free scripted repair is still a model decision and cannot claim deterministic continuation", () => {
  const predecessor = { flowId: "flow-one", stepsDigest: "a".repeat(64), flowVersion: 1 };
  const input = { predecessor, before: predecessor, result: { flowId: "flow-one", path: "replayed" as const, status: "achieved" as const, cost: { calls: 0, tokens: 0, usd: 0 } }, scriptedRequests: 0 };
  assert.equal(hostProofContinuation(input), true);
  assert.equal(hostProofContinuation({ ...input, scriptedRequests: 1 }), false);
  assert.equal(hostProofContinuation({ ...input, result: { ...input.result, cost: { calls: 1, tokens: 0, usd: 0 } } }), false);
  assert.equal(hostProofContinuation({ ...input, before: { ...predecessor, stepsDigest: "b".repeat(64) } }), false);
  assert.equal(hostProofContinuation({ ...input, predecessor: { flowId: predecessor.flowId, flowVersion: 1 }, before: { flowId: predecessor.flowId, flowVersion: 1 } }), false);
  assert.equal(hostProofContinuation({ ...input, result: { ...input.result, flowId: "another-flow" } }), false);
});
