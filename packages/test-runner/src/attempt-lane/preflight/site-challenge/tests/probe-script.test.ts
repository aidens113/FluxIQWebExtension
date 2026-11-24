import assert from "node:assert/strict";
import test from "node:test";
import type { ScriptedModelRequest } from "../../../scripted-model/index.js";
import { newProbeSink, siteChallengeProbeScript } from "../index.js";

/** A decision request whose evidence window holds `evidence`, as Core writes it. */
function request(evidence: readonly object[]): ScriptedModelRequest {
  return { kind: "evidence_tool_decision", ordinal: 1, model: "m", jsonText: false, message: "", payload: { context: { evidenceLoop: { evidence } } } };
}
const look = (page: string) => ({ callId: "look", toolId: "core.current_view", value: { page } });
const decision = (reply: unknown) => (reply as { decision: { kind: string; toolId?: string; input?: { node: string } } }).decision;

test("the probe model reads once and never touches a check", () => {
  const sink = newProbeSink();
  const decide = siteChallengeProbeScript("t", ["Robot or human?"], sink).replies.evidence_tool_decision![0]!;
  const first = decision(decide(request([look("Robot or human?\nt1 button Hold")])));
  assert.equal(first.toolId, "core.run_node");
  assert.equal(first.input?.node, "web.output.dom-capture_snapshot");
  assert.equal(sink.firstPageShowedCheck, true);
  const done = decision(decide(request([look("Welcome"), { callId: "preflight-read", toolId: "core.run_node", value: { ok: true } }])));
  assert.equal(done.kind, "complete");
  assert.deepEqual({ read: sink.readSucceeded, gone: sink.checkGoneAfterRead, decisions: sink.decisions, keys: sink.readResultKeys }, { read: true, gone: true, decisions: 2, keys: ["ok"] });
});

test("a read that answered with an error is not a read", () => {
  const sink = newProbeSink();
  siteChallengeProbeScript("t", ["x"], sink).replies.evidence_tool_decision![0]!(request([look("page"), { callId: "preflight-read", toolId: "core.run_node", value: { ok: false, code: "FAILED" } }]));
  assert.equal(sink.readSucceeded, false);
});
