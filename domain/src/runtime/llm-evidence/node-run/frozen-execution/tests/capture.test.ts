import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { captureEvidence } from "../../../capture";
import { webPacketElementFingerprint } from "../../../packet-fingerprint";
import { webRunnableNode } from "../../catalog";
import type { WebNodeFrozenCommand, WebNodeFrozenResult } from "../types";
import { NOW, TYPE, frozenHarness } from "./harness";

async function prepared(nodeId = TYPE, extra: JsonObject = {}) {
  const host = frozenHarness();
  const node = webRunnableNode(nodeId)!;
  const value = { node: nodeId, parameters: { target: { handle: "t1" }, ...extra }, consequences: [] };
  const run = host.asRun(value);
  const before = await captureEvidence(run.gateway, run.sessionId, run.request);
  const element = before.evidence.elements[0]!;
  const parameters: JsonObject = { selector: "#original", element: webPacketElementFingerprint(element, { selector: "#original", recordIdentity: before.recordIdentities?.get(element.target) }) as unknown as JsonObject, ...extra };
  const capture = await host.binding.capture({ run, node, value, adapterValue: run.request.value, written: value.parameters, parameters, before, look: async () => undefined });
  assert.ok(capture);
  const command: WebNodeFrozenCommand = { actionType: node.actionType, parameters: capture.parameters, metadata: { callId: run.request.callId } };
  const send = (next = command) => capture.dispatch(next, () => run.gateway.executeAction(run.sessionId, next));
  return { host, capture, command, send };
}

test("post-gateway defaults are explicitly linked to the canonical logical command", async () => {
  const { host, capture, send } = await prepared("web.output.dom-click", { timeoutMs: 1200 });
  await send();
  capture.publish();
  assert.equal(host.snapshots.length, 1);
  const snapshot = host.snapshots[0]!;
  assert.equal(snapshot.parameters.timeoutMs, 16_200);
  assert.equal(snapshot.parameters.checkWaitMs, 15_000);
  assert.equal(snapshot.referenceNow, NOW);
  assert.deepEqual(snapshot.parameters, host.mainCommands()[0]!.parameters);
});

test("all actual normal/fresh attempts are retained and the selected receipt belongs to the final fresh payload", async () => {
  const { host, capture, command, send } = await prepared(TYPE, { text: "Frozen text" });
  let calls = 0;
  host.answer(() => ++calls < 2 ? { status: "failed", failure: { category: "target_not_found", code: "web.target.not_found", retryable: true, effect: "unacted" } } : { status: "succeeded", payload: { value: "fresh" } });
  await send();
  const original = command.parameters.element as JsonObject;
  const fresh = { ...command, parameters: { ...command.parameters, selector: "#fresh", element: { ...original, selector: "#fresh" } } };
  capture.refreshed(fresh.parameters);
  await send(fresh);
  capture.publish();
  const snapshot = host.snapshots[0]!;
  assert.ok(snapshot);
  assert.deepEqual(snapshot.dispatch.attempts.map((attempt) => attempt.outcome), ["failed_unacted", "succeeded"]);
  assert.equal(snapshot.dispatch.selected, snapshot.dispatch.attempts[1]?.identity);
  assert.equal(snapshot.parameters.selector, "#fresh");
  assert.equal(snapshot.parameters.text, "Frozen text");
  assert.notEqual(snapshot.dispatch.attempts[0]?.identity, snapshot.dispatch.attempts[1]?.identity);
  capture.publish();
  assert.equal(host.snapshots.length, 1, "the sink is published only once");
});

test("unknown/uncertain attempts cannot be laundered by a later success", async () => {
  for (const uncertain of [false, true]) {
    const { host, capture, send } = await prepared(TYPE, { text: "Fixed" });
    let calls = 0;
    const initial: WebNodeFrozenResult = { status: "timed_out" };
    if (uncertain) {
      const failure = { category: "target_not_found", code: "web.target.not_found", retryable: true, effect: "ambiguous" };
      initial.failure = failure;
    }
    host.answer(() => ++calls === 1 ? initial : { status: "succeeded" });
    await send();
    await send();
    capture.publish();
    assert.equal(host.snapshots.length, 0);
  }
});

test("a different subject or changed non-address argument never acquires frozen proof", async () => {
  for (const change of ["subject", "text"] as const) {
    const { host, capture, command, send } = await prepared(TYPE, { text: "Fixed" });
    const element = command.parameters.element as JsonObject;
    const parameters: JsonObject = { ...command.parameters, selector: "#fresh" };
    if (change === "text") parameters.text = "Changed";
    else parameters.element = { ...element, context: { record: { key: "other", keyAttribute: "data-profile-id" } } };
    const fresh: WebNodeFrozenCommand = { ...command, parameters };
    capture.refreshed(fresh.parameters);
    await send(fresh);
    capture.publish();
    assert.equal(host.snapshots.length, 0, change);
  }
});

test("a gateway without the final-lowering observer remains an ordinary unproven producer", async () => {
  const { host, capture, command } = await prepared(TYPE);
  await capture.dispatch(command, async () => ({ status: "succeeded" }));
  capture.publish();
  assert.equal(host.snapshots.length, 0);
});

test("a success status cannot conceal an uncertain failure record", async () => {
  const { host, capture, send } = await prepared(TYPE);
  host.answer(() => ({ status: "succeeded", failure: { category: "target_not_found", code: "web.target.not_found", retryable: true, effect: "ambiguous" } }));
  await send();
  capture.publish();
  assert.equal(host.snapshots.length, 0);
});
