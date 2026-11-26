import assert from "node:assert/strict";
import test from "node:test";
import type { ScriptedModelRequest } from "../../wire-request.js";
import { callsMade, evidenceOf, heldRowsOf } from "../evidence.js";

function request(evidence: readonly Record<string, unknown>[]): ScriptedModelRequest {
  return { kind: "evidence_tool_decision", ordinal: 1, model: "m", jsonText: true, message: "", payload: { taskKind: "evidence_tool_decision", context: { evidenceLoop: { evidence } } } };
}
const entry = (callId: string, value: Record<string, unknown>, toolId = "core.run_node") => ({ callId, toolId, value });

test("calls whose results were not refused are done", () => {
  assert.deepEqual([...callsMade(request([entry("a", { ok: true }), entry("b", {}), entry("c", { page: "x" }, "core.current_view")]))], ["a", "b", "c"]);
});

test("a refused call stops the script, naming the call and the refusal's words", () => {
  const refused = entry("read-1", { ok: false, code: "target_unobserved", detail: { reason: "malformed_handle", instead: ["web.handle.malformed:extractList.fields.2"] } });
  assert.throws(() => callsMade(request([entry("a", { ok: true }), refused])), /read-1 \(core\.run_node\) was refused: target_unobserved; malformed_handle; web\.handle\.malformed:extractList\.fields\.2/u);
  assert.throws(() => callsMade(request([entry("x", { ok: false })])), /x \(core\.run_node\) was refused: \{"ok":false\}/u);
});

test("a call whose refusal the script reports itself is counted and is not a stop here", () => {
  const made = callsMade(request([entry("read-1", { ok: false }), entry("detect", { ok: true })]), (callId) => callId.startsWith("read-"));
  assert.deepEqual([...made], ["read-1", "detect"]);
  assert.throws(() => callsMade(request([entry("detect", { ok: false })]), (callId) => callId.startsWith("read-")), /detect/u);
});

test("a read's held rows are found through its reference under any group name, and only by that call's own group", () => {
  const rows = [{ name: "A" }];
  const read = entry("r", { ok: true, read: { extracted: { "core.view_reference": { callId: "r", group: "holder:read:750f72d20954" } } } });
  const view = (group: string, callId = "r", holder = "read") => entry("core.current_view", { groups: [{ group, callId, holder, value: { extracted: rows } }] }, "core.current_view");
  assert.deepEqual(heldRowsOf(read, evidenceOf(request([read, view("holder:read:750f72d20954")]))), rows);
  assert.equal(heldRowsOf(read, evidenceOf(request([read, view("holder:read")]))), undefined);
  assert.equal(heldRowsOf(read, evidenceOf(request([read, view("holder:read:750f72d20954", "other")]))), undefined);
  assert.equal(heldRowsOf(read, evidenceOf(request([read, view("holder:read:750f72d20954", "r", "other")]))), undefined);
  assert.equal(heldRowsOf(read, evidenceOf(request([read]))), undefined);
  assert.deepEqual(heldRowsOf(entry("r", { read: { extracted: rows } }), []), rows);
});
