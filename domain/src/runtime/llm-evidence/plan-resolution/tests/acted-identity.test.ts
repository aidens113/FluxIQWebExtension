// A control exploration acted on keeps its handle and its identity at the act (t442).
//
// R4a and R4b (`run-mv4dcf2j-cb68009a`, `run-mv4dgmki-2b13db91`): exploration pressed crossborder's
// "Get coupons", the page relabelled it "Collected" and gave it a second class, and the candidate's step for it
// was saved as `{div, class b}` -- the identity the two views agreed on -- with no words at all
// (`reports/r4b-coupon-step-identity.md`). Held here on the whole path: the press runs through the node runner
// (`../../node-run/run.ts`), which names the control it acted on by handle on its result and records the view it
// acted from (`../target-packets.ts` `acted`); a candidate's step on that handle then saves "Get coupons"; and
// exploration's own act on the control as it now is still asks for nothing the act took away. Below, the same
// control changed by an act this Flow did not make (t596).

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "../..";
import { WEB_LLM_VIEW_KEYS } from "../../observed-state";
import { shownHandle } from "../../page-view/tests/shown-page-lines";
import { webElementIdentitySignals } from "../../../../element-fingerprint";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { createWebLlmStableTargetHandles } from "../../stable-handles";
import { createWebLlmExtractionHandles } from "../../structure";
import { createWebLlmTargetPackets, resolveWebPlanNodeParameters, type WebPlanNodeResolutionInput } from "..";
import { webPlanElementIdentityAcrossViews, type WebPlanElementIdentity } from "../element-identity";

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

  // Exploration acts on the page as it now is: nothing the act took away, and -- since the agreement alone, `div` and
  // class `b`, would name it one way where each view named it three (t596) -- the words the page now shows.
  const exploring = await runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: CLICK, parameters: { target: { handle: coupon } }, gatedByCaller: true });
  assert.equal(exploring.status, "resolved", JSON.stringify(exploring));
  if (exploring.status !== "resolved") return;
  assert.equal((exploring.parameters.element as JsonObject).visibleText, "Collected");
  assert.deepEqual((exploring.parameters.element as JsonObject).classNames, ["b"], "the class the act toggled is still not the control's");
});

// The identity one handle keeps across its views (`../element-identity.ts`
// `webPlanElementIdentityAcrossViews`, t596).
//
// A8 (`run-mv8c76i3-61b9ca89`, brief-2): the handle store keeps every view any
// brief of the build took of a control. Brief-1 saw crossborder's store coupon
// as `<div>` "Get coupons" with class `b`; brief-2's entry preparation pressed
// it, and brief-2's builder was shown `<div>` "Collected" with `b x`. Nothing
// this Flow's exploration did recorded the view before the press (`acted`), so
// the identity was the views' agreement, `div` and class `b` -- one signal --
// and every submission naming the coupon was refused
// `web.handle.unidentifiable` although each view alone named it three ways.
//
// Held here: the agreement never leaves a control thinner than the thinner of
// its views; the newest view lends what it lacks, and only that; a class an act
// toggled is still dropped where the agreement names the control well enough;
// and a control every view describes thinly is still refused at save.

const A8_SCOPE = { projectId: "project.a8", flowId: "flow.a8" };

const a8Coupon = (label: string | undefined, classes: string): JsonObject => {
  const element: JsonObject = { tagName: "div", selector: COUPON, hasClickHandler: true, classNames: classes.split(" "), attributes: { class: classes } };
  if (label !== undefined) element.visibleText = label;
  return element;
};
const ADD: JsonObject = { tagName: "button", selector: "#add-to-cart", visibleText: "Add to cart" };

function signals(identity: WebPlanElementIdentity | JsonObject): number {
  return webElementIdentitySignals(identity as WebPlanElementIdentity).length;
}

/** The build's handle store after two views of the item page, numbered for the whole build as the authoring tools number them. */
function viewed(first: JsonObject, second: JsonObject) {
  const targets = createWebLlmTargetPackets();
  const handles = createWebLlmStableTargetHandles();
  const capture = (elements: JsonObject[]) => handles.restamp(A8_SCOPE, sanitizeWebLlmSnapshotWithBindings({ url: URL_, interactiveElements: elements }));
  const before = capture([first, ADD]);
  targets.remember(A8_SCOPE, before);
  const handle = [...before.selectors].find(([, selector]) => selector === COUPON)?.[0];
  if (handle === undefined) throw new Error("the coupon has no handle");
  targets.remember(A8_SCOPE, capture([second, ADD]));
  return { targets, handle, stores: { targets, extractions: createWebLlmExtractionHandles() } };
}

function candidateInput(handle: string, extra: Partial<WebPlanNodeResolutionInput> = {}): WebPlanNodeResolutionInput {
  return { ...A8_SCOPE, nodeDefinitionId: CLICK, parameters: { target: { handle } }, declaredConsequences: [], permission: async () => ({ permitted: true as const }), ...extra };
}

test("two views of one control that differ in its words and one class merge to no fewer signals than the thinner view had", () => {
  const earlier: WebPlanElementIdentity = { tagName: "div", selector: COUPON, visibleText: "Get coupons", classNames: ["b"] };
  const newer: WebPlanElementIdentity = { tagName: "div", selector: COUPON, visibleText: "Collected", classNames: ["b", "x"] };
  assert.equal(signals(earlier), 3);
  assert.equal(signals(newer), 3);
  const merged = webPlanElementIdentityAcrossViews(earlier, newer);
  // The words come from the newest view, the one the builder acting now was shown; the toggled class is still the act's.
  assert.deepEqual(merged, { tagName: "div", selector: COUPON, visibleText: "Collected", classNames: ["b"] });
  assert.equal(signals(merged), 3);
});

test("the agreement stands where it names the control as well as the thinner view: an act's toggled class is still dropped", () => {
  const earlier: WebPlanElementIdentity = { tagName: "div", selector: COUPON, visibleText: "Get coupons", classNames: ["b"] };
  const newer: WebPlanElementIdentity = { tagName: "div", selector: COUPON, visibleText: "Get coupons", classNames: ["b", "x"] };
  assert.deepEqual(webPlanElementIdentityAcrossViews(earlier, newer), earlier);
});

test("a stable fact the newest view gives is lent before its words", () => {
  const earlier: WebPlanElementIdentity = { tagName: "div", selector: COUPON, visibleText: "Get coupons", testId: "coupon-a" };
  const newer: WebPlanElementIdentity = { tagName: "div", selector: COUPON, visibleText: "Collected", label: "Store coupon", testId: "coupon-b" };
  assert.equal(signals(earlier), 3);
  const merged = webPlanElementIdentityAcrossViews(earlier, newer);
  // Kind, label and test id already make three, the thinner view's count: the words the act may have put there are not adopted.
  assert.deepEqual(merged, { tagName: "div", selector: COUPON, label: "Store coupon", testId: "coupon-b" });
  assert.equal(signals(merged), 3);
});

test("A8 brief-2 rebuilt: a candidate naming the coupon a predecessor's act changed resolves with at least two signals", async () => {
  const { handle, stores } = viewed(a8Coupon("Get coupons", "b"), a8Coupon("Collected", "b x"));
  const answer = await resolveWebPlanNodeParameters(candidateInput(handle, { handleReach: "view_history" }), stores);
  assert.equal(answer.status, "resolved", JSON.stringify(answer));
  if (answer.status !== "resolved") return;
  const element = answer.parameters.element as JsonObject;
  assert.equal(answer.parameters.selector, COUPON);
  assert.equal(element.visibleText, "Collected", "as the builder was shown it");
  assert.deepEqual(element.classNames, ["b"]);
  assert.ok(signals(element) >= 2, JSON.stringify(element));
});

test("a control every view describes by its tag and one class is still refused at save", async () => {
  const thin = viewed(a8Coupon(undefined, "b"), a8Coupon(undefined, "b"));
  assert.deepEqual(await resolveWebPlanNodeParameters(candidateInput(thin.handle), thin.stores), {
    status: "refused", issueCodes: ["web.handle.unidentifiable", "web.handle.unidentifiable:target"]
  });
  // The thinner view named it one way, so a newer view's second class lends it nothing it never had.
  const toggled = viewed(a8Coupon(undefined, "b"), a8Coupon(undefined, "b x"));
  assert.deepEqual(await resolveWebPlanNodeParameters(candidateInput(toggled.handle), toggled.stores), {
    status: "refused", issueCodes: ["web.handle.unidentifiable", "web.handle.unidentifiable:target"]
  });
});
