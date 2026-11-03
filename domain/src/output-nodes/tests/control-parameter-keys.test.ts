// Core's checked rerun plus the real web keys answers as Core alone used to when
// it named these keys itself: another control is refused, a new value on the same
// control takes, and the answer's sentences keep their exact words.

import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioNodeRerunAnswer } from "fluxiq/automation";
import { WEB_CONTROL_PARAMETER_KEYS } from "../control-parameter-keys";
import { createWebAutomationOutputNodeImplementationBundle } from "../native-runtime";

type Rerun = Parameters<typeof automationStudioNodeRerunAnswer>[0];

const donePress = () => ({
  position: 13, id: "d13", iteration: 4, actionId: "web.output.dom-click", toolId: "core.run_node",
  input: { node: "web.output.dom-click", parameters: { target: { handle: "t934" } }, consequences: [] },
  ranWith: { node: "web.output.dom-click", parameters: { selector: "#coupon", text: "1", element: { tagName: "button", accessibleName: "Get coupons" } }, consequences: [] },
  effect: "mutate" as const, effectApplied: true, disposition: "kept" as const, acts: ["a2"]
}) as unknown as NonNullable<Rerun["replaces"]>;
const verified: Rerun["executeTool"] = async () => ({ kind: "llm_evidence_tool_execution", evidence: { ok: true, code: "core.replay.verified" }, effectApplied: false, resultCode: "core.replay.verified" });
const check = (step: NonNullable<Rerun["replaces"]>, parameters: Record<string, never> | Rerun["call"]["value"]) => automationStudioNodeRerunAnswer({
  place: undefined, replaces: step, executeTool: verified, lastingActs: new Set(["a2"]), controlParameterKeys: WEB_CONTROL_PARAMETER_KEYS,
  call: { callId: "rerun.13", toolId: "core.run_node", value: { node: "web.output.dom-click", parameters, consequences: [] } }
});
const detailOf = (ran: unknown): string => (ran as { evidence: { rerunCheck: { detail: string } } }).evidence.rerunCheck.detail;

test("the bundle gives Core these keys", () => {
  assert.equal(createWebAutomationOutputNodeImplementationBundle().controlParameterKeys, WEB_CONTROL_PARAMETER_KEYS);
});

test("each of the three keys names the control", async () => {
  for (const [key, value] of [["target", { handle: "t964" }], ["selector", "#plus"], ["element", { accessibleName: "+" }]] as const) {
    const step = donePress();
    const before = structuredClone(step);
    const { ran, took } = await check(step, { [key]: value });
    assert.equal(took, false, key);
    assert.deepEqual(step, before, key);
    assert.match(detailOf(ran), /names another control than the one step 13 ran on/u, key);
  }
});

test("repeating the control the step ran with is no move", async () => {
  const { took } = await check(donePress(), { selector: "#coupon" });
  assert.equal(took, true);
});

test("a new value for a parameter the step ran with takes, and its resolved form follows", async () => {
  const step = donePress();
  const { took } = await check(step, { text: "3" });
  assert.equal(took, true);
  assert.deepEqual((step.ranWith as { parameters: unknown }).parameters, { selector: "#coupon", text: "3", element: { tagName: "button", accessibleName: "Get coupons" } });
});

test("a parameter of a kind the step never ran with is refused by name, not as another control", async () => {
  const { ran, took } = await check(donePress(), { submit: true });
  assert.equal(took, false);
  assert.match(detailOf(ran), /gives web\.output\.dom-click "submit", which step 13 never ran with/u);
});
