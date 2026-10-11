// A control exploration acted on keeps its handle and its identity at the act (t442).
//
// R4a and R4b (`run-mv4dcf2j-cb68009a`, `run-mv4dgmki-2b13db91`): exploration pressed crossborder's
// "Get coupons", the page relabelled it "Collected" and gave it a second class, and the candidate's step for it
// was saved as `{div, class b}` -- the identity the two views agreed on -- with no words at all
// (`reports/r4b-coupon-step-identity.md`). Held here on the whole path: the press runs through the node runner
// (`../../node-run/run.ts`), which names the control it acted on by handle on its result and records the view it
// acted from (`../target-packets.ts` `acted`); a candidate's step on that handle then saves "Get coupons"; and
// exploration's own act on the control as it now is still asks for nothing the act took away.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "../..";
import { WEB_LLM_VIEW_KEYS } from "../../observed-state";
import { shownHandle } from "../../page-view/tests/shown-page-lines";

const SCOPE = { projectId: "project.acted", flowId: "flow.acted" };
const URL_ = "https://crossborder.test/item/1005008123450";
const CLICK = webAutomationOutputNodeId("web.dom.click");
const COUPON = "#coupons > div:nth-of-type(2)";

/** A store coupon whose press collects it: "Get coupons" with class `b`, then "Collected" with `b x`. */
function store(): WebAutomationLlmEvidenceRuntime {
  let collected = false;
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.click") {
        if (command.parameters.selector === COUPON) collected = true;
        return { status: "succeeded" };
      }
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const classes = collected ? "b x" : "b";
      const elements: JsonObject[] = [
        { tagName: "h2", selector: "#coupons > h2", visibleText: "Store coupons" },
        { tagName: "div", selector: COUPON, visibleText: collected ? "Collected" : "Get coupons", hasClickHandler: true, classNames: classes.split(" "), attributes: { class: classes } }
      ];
      return { status: "succeeded", payload: { snapshot: { url: URL_, title: "Item", interactiveElements: elements } } };
    }
  });
}

let calls = 0;
async function run(runtime: WebAutomationLlmEvidenceRuntime, node: string, parameters: JsonObject) {
  calls += 1;
  return await runtime.executeTool({ ...SCOPE, callId: `call.${calls}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node, parameters, consequences: [] } });
}

test("the press names the control it acted on by handle, outside the view a newer one replaces", async () => {
  const runtime = store();
  const looked = await run(runtime, "web.output.dom-capture_snapshot", {});
  assert.equal((looked.evidence as { controlHandle?: string }).controlHandle, undefined, "a look acted on no control");
  const coupon = shownHandle(looked.evidence, "Get coupons");
  const pressed = await run(runtime, CLICK, { target: { handle: coupon } });
  const outcome = pressed.evidence as { pageChanged?: boolean; control?: string; controlHandle?: string };
  assert.equal(outcome.pageChanged, true, JSON.stringify(pressed.evidence));
  assert.equal(outcome.control, "Get coupons");
  assert.equal(outcome.controlHandle, coupon);
  // Core's context window replaces only the view keys of an older result (`WEB_LLM_VIEW_KEYS`), so the handle stays.
  assert.equal(WEB_LLM_VIEW_KEYS.includes("controlHandle"), false);
});

test("a candidate's step on the coupon exploration collected saves it as the act found it, words and class", async () => {
  const runtime = store();
  const looked = await run(runtime, "web.output.dom-capture_snapshot", {});
  const coupon = shownHandle(looked.evidence, "Get coupons");
  await run(runtime, CLICK, { target: { handle: coupon } });
  await run(runtime, "web.output.dom-capture_snapshot", {});

  const candidate = await runtime.resolvePlanNodeParameters({
    ...SCOPE, nodeDefinitionId: CLICK, parameters: { target: { handle: coupon } }, declaredConsequences: [], permission: async () => ({ permitted: true as const }), handleReach: "view_history"
  });
  assert.equal(candidate.status, "resolved", JSON.stringify(candidate));
  if (candidate.status !== "resolved") return;
  const element = candidate.parameters.element as JsonObject;
  assert.equal(candidate.parameters.selector, COUPON);
  assert.equal(element.visibleText, "Get coupons");
  assert.deepEqual(element.classNames, ["b"]);
  assert.ok(!JSON.stringify(candidate).includes("Collected"), "the act's words are its effect, never the step's identity");

  // Exploration acts on the page as it now is with the identity the views agree on: nothing the act took away.
  const exploring = await runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: CLICK, parameters: { target: { handle: coupon } }, gatedByCaller: true });
  assert.equal(exploring.status, "resolved", JSON.stringify(exploring));
  if (exploring.status === "resolved") assert.equal((exploring.parameters.element as JsonObject).visibleText, undefined);
});
