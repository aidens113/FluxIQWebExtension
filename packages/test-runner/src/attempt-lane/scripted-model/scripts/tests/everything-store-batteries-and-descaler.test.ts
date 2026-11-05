import assert from "node:assert/strict";
import test from "node:test";
import { scriptedModelScriptFor, type EvidenceEntry, type ScriptedModelRequest } from "../../index.js";

const SCRIPT = scriptedModelScriptFor("everything-store-batteries-and-descaler");

const CART = [
  "URL ~/cart",
  't311 checkbox "Select Brightaisle Basics AA Alkaline Batteries, 48 Count" checked',
  't326 clickable "Increase quantity by one"',
  't400 checkbox "Select Tidewell Kettle Descaler, Citric Acid Limescale Remover, 4 Pack" checked',
  't401 link "Tidewell Kettle Descaler, Citric Acid Limescale Remover, 4 Pack" ~/dp/B0TWDESC04',
  't402 clickable "Increase quantity by one"',
].join("\n");

const made = (...callIds: readonly string[]): EvidenceEntry[] => callIds.map((callId) => ({ callId, toolId: "core.run_node", value: { ok: true } }));

function request(page: string, extra: readonly EvidenceEntry[]): ScriptedModelRequest {
  const evidence = [...extra, { callId: "core.current_view", toolId: "core.current_view", value: { groups: [{ group: "top", callId: "x", value: { page } }] } }];
  return { kind: "evidence_tool_decision", ordinal: 1, model: "m", jsonText: true, message: "", payload: { taskKind: "evidence_tool_decision", context: { evidenceLoop: { evidence } } } };
}

type Called = { decision: { kind: string; callId?: string; toolId?: string; input?: { consequences?: string[]; parameters?: Record<string, any> } } };
const decide = (extra: readonly EvidenceEntry[], page = CART) => (SCRIPT.replies.evidence_tool_decision![0]!(request(page, extra)) as Called).decision;

test("it lands the descaler a second time through its own line in the cart, declaring nothing", () => {
  const again = decide(made("raise-batteries-1", "raise-batteries-2", "add-descaler"));
  assert.equal(again.callId, "increase-descaler");
  assert.equal(again.input?.parameters?.target.handle, "t402");
  assert.deepEqual(again.input?.consequences, []);
});

test("it raises the batteries from their own line, and adds the descaler from its offer", () => {
  assert.equal(decide(made()).input?.parameters?.target.handle, "t326");
  const offer = 'URL ~/cart\nt500 link "Tidewell Kettle Descaler, 4 Pack" ~/dp/B0TWDESC04\nt501 button "Add to Cart"';
  assert.equal(decide(made("raise-batteries-1", "raise-batteries-2"), offer).input?.parameters?.target.handle, "t501");
});

test("it reads the cart's lines by what each field shows, then completes", () => {
  const detected: EvidenceEntry = { callId: "detect", toolId: "web.detect_repeating_structure", value: { extraction: "extraction.1", fields: [{ key: "a_span", sample: "Tidewell Kettle Descaler" }, { key: "live", sample: "2" }, { key: "p_span", sample: "$9.99" }] } };
  const done = made("raise-batteries-1", "raise-batteries-2", "add-descaler", "increase-descaler");
  assert.equal(decide(done).toolId, "web.detect_repeating_structure");
  assert.deepEqual(decide([...done, detected]).input?.parameters?.extractList.fields, { item: "a_span", quantity: "live", price: "p_span" });
  assert.equal(decide([...done, detected, ...made("read-cart")]).kind, "complete");
});
