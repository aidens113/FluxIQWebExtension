// A press whose answer was lost, judged on the page from the pressed control
// (t430): gone is `landed`, still shown as only a way out is `not_landed`, and
// anything else -- a "Confirm" still shown, a page that cannot say, a node that
// is not a press -- is `unknown`. The step's declared consequences are never
// read: a `consequences: none` press of an offer button still shown stays
// `unknown`, so it is never pressed again on the declaration's word.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import type { WebAutomationFactCondition, WebAutomationFactEvaluator, WebAutomationFactResult } from "../../facts";
import { webAutomationActLanded, type WebAutomationActLandedInput } from "../landing";

const NOT_NOW = '[role="dialog"][aria-modal="true"]:has([aria-label="Close"]) > div:last-child > [role="button"]:first-child';

function press(parameters: JsonObject, metadata: JsonObject = { declaredConsequences: [] }): WebAutomationActLandedInput {
  // As a saved Flow's node is: the step's declaration beside the parameters, which the look never reads.
  const node = { id: "s2", definitionId: "web.output.dom-click", parameterValues: parameters, metadata };
  return { node, attemptId: "s2.attempt.1", timeoutMs: 2_000 };
}

/** A page whose reads come back as `reads` in turn (the last repeated), shown with `name`, on a clock the look advances. */
function page(reads: Array<WebAutomationFactResult["result"]>, name?: string) {
  const asked: WebAutomationFactCondition[][] = [];
  let clock = 0;
  const evaluate: WebAutomationFactEvaluator = async (conditions) => {
    asked.push(conditions as WebAutomationFactCondition[]);
    const result = reads[Math.min(asked.length - 1, reads.length - 1)]!;
    return [{ result, capturedAt: clock, ...(result === "true" && name ? { evidence: { element: { tagName: "div", role: "button", accessibleName: name } } } : {}) }];
  };
  const pace = { now: () => clock, delay: async (ms: number) => { clock += ms; } };
  return { asked, evaluate, pace };
}

test("a control no longer shown landed: its layer went with it, and it is asked about once", async () => {
  const shown = page(["false"]);
  assert.equal(await webAutomationActLanded(press({ selector: NOT_NOW }), shown.evaluate, shown.pace), "landed");
  assert.deepEqual(shown.asked, [[{ fact: "visible", op: "visible", target: { selector: NOT_NOW } }]]);
});

test("a way out still shown after the window did not land, so it may be pressed again", async () => {
  for (const name of ["Not now", "Close chat", "×", "No thanks", "Dismiss"]) {
    const shown = page(["true"], name);
    assert.equal(await webAutomationActLanded(press({ selector: NOT_NOW }), shown.evaluate, shown.pace), "not_landed", name);
    // Looked at until the window ended, so a layer still animating out is not pressed twice.
    assert.ok(shown.asked.length > 2, name);
  }
});

test("a way out that leaves while the window lasts landed", async () => {
  const shown = page(["true", "true", "false"], "Not now");
  assert.equal(await webAutomationActLanded(press({ selector: NOT_NOW }), shown.evaluate, shown.pace), "landed");
  assert.equal(shown.asked.length, 3);
});

test("a committing control still shown proves nothing, whatever its step declared", async () => {
  for (const name of ["Confirm", "Get coupons", "Add to cart", "Close account", "Decline", "OK", undefined]) {
    const shown = page(["true"], name);
    assert.equal(await webAutomationActLanded(press({ selector: "#offer" }, { declaredConsequences: [] }), shown.evaluate, shown.pace), "unknown", String(name));
  }
});

test("a page that cannot say, a node that is not a press, and a press with no target are unknown", async () => {
  const silent = page(["unknown"]);
  assert.equal(await webAutomationActLanded(press({ selector: NOT_NOW }), silent.evaluate, silent.pace), "unknown");
  const typed = page(["false"]);
  assert.equal(await webAutomationActLanded({ ...press({ selector: "#q" }), node: { id: "s3", definitionId: "web.output.dom-type", parameterValues: { selector: "#q", text: "lamp" } } }, typed.evaluate, typed.pace), "unknown");
  assert.equal(typed.asked.length, 0);
  const bare = page(["false"]);
  assert.equal(await webAutomationActLanded(press({}), bare.evaluate, bare.pace), "unknown");
  assert.equal(bare.asked.length, 0);
});

test("a cancelled run asks nothing", async () => {
  const shown = page(["false"]);
  const controller = new AbortController();
  controller.abort();
  assert.equal(await webAutomationActLanded({ ...press({ selector: NOT_NOW }), signal: controller.signal }, shown.evaluate, shown.pace), "unknown");
  assert.equal(shown.asked.length, 0);
});
