// The reevaluator as the experiment watches it: each ask is kept as the
// recorded operation it stood for, the differing field paths, the answer's
// status and gap reason, and the page evaluations it made; the answer itself
// passes through unchanged, and a reevaluator that throws still throws.

import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewayTraceReevaluation, ClientGatewayTraceReevaluationRequest, ClientGatewayTraceReevaluator } from "fluxiq/client-gateway";
import { recordingReevaluator } from "../recording-reevaluator.js";
import type { SnapshotEvaluationSummary } from "../recording-snapshot-page.js";

const REQUEST = {
  traceId: "trace.x", command: {}, recordedCommand: {}, recordedResult: {}, artifacts: [], readArtifact: async () => undefined,
  operation: { actionType: "web.dom.extract_list", compared: { actionType: "web.dom.extract_list", target: null, parameters: {} }, key: "k" },
  recorded: { actionType: "web.dom.extract_list", compared: { actionType: "web.dom.extract_list", target: null, parameters: {} }, key: "r", sequence: 78, logicalMs: 0, commandId: "c", session: undefined, redacted: false },
  fields: ["parameters.extractList.where"],
} satisfies ClientGatewayTraceReevaluationRequest;

const EVALUATION: SnapshotEvaluationSummary = { commandId: "c", actionType: "web.dom.extract_list", snapshot: "abc", status: "evaluated", reason: null, resultStatus: "succeeded", failureCode: null, rows: 3, observations: null, ms: 1 };

test("an answer passes through and the ask is kept with the evaluations it made", async () => {
  const answer: ClientGatewayTraceReevaluation = { status: "answered", result: { status: "succeeded" } };
  let pending: SnapshotEvaluationSummary[] = [];
  const inner: ClientGatewayTraceReevaluator = {
    reevaluate: async () => {
      pending = [EVALUATION, EVALUATION];
      return answer;
    },
  };
  const take = (): SnapshotEvaluationSummary[] => {
    const taken = pending;
    pending = [];
    return taken;
  };
  const recording = recordingReevaluator(inner, take);
  assert.equal(await recording.reevaluator.reevaluate(REQUEST), answer);
  assert.deepEqual(recording.asks(), [{ recordedSequence: 78, actionType: "web.dom.extract_list", fields: ["parameters.extractList.where"], status: "answered", reason: null, evaluations: [EVALUATION, EVALUATION] }]);
});

test("a gap keeps its reason, a decline its status, and a throw is kept and rethrown", async () => {
  const answers: ClientGatewayTraceReevaluation[] = [{ status: "gap", reason: "dynamic_content", fields: ["parameters.extractList.where"] }, { status: "declined" }];
  const inner: ClientGatewayTraceReevaluator = {
    reevaluate: async () => {
      const next = answers.shift();
      if (next === undefined) throw new Error("store broke");
      return next;
    },
  };
  const recording = recordingReevaluator(inner, () => []);
  await recording.reevaluator.reevaluate(REQUEST);
  await recording.reevaluator.reevaluate(REQUEST);
  await assert.rejects(recording.reevaluator.reevaluate(REQUEST), /store broke/u);
  assert.deepEqual(recording.asks().map((ask) => [ask.status, ask.reason]), [["gap", "dynamic_content"], ["declined", null], ["threw", "Error"]]);
});
