// A step a build created knows its own effect (t447, `r4b-coupon-step-identity.md` F2).
//
// t442 saves the coupon step as exploration's press found its control ("Get coupons"). What the press made true
// ("Collected" in its place) is the step's effect: `acted` keeps it beside the identity, from the very captures the
// press was made from and left (`../act-effect.ts`), and a candidate's resolution answers it to Core, which writes it
// onto the Flow node's `routeSignatures.effect`. Held here on the whole path, through the node runner: the effect
// holds by the host's own test (`routeEffectHolds`) on a page that already holds the coupon and not on a fresh one;
// it is never answered where no identity was acted on; and the build test's check of the step answers `present`
// when the page shows it, whatever the control now reads.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import { webAutomationRouteEffectHolds } from "../../../route-state";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "../..";
import { shownHandle } from "../../page-view/tests/shown-page-lines";

const SCOPE = { projectId: "project.effect", flowId: "flow.effect" };
const URL_ = "https://crossborder.test/item/1005008123450";
const CLICK = webAutomationOutputNodeId("web.dom.click");
const LOOK = webAutomationOutputNodeId("web.dom.capture_snapshot");
const COUPON = "#coupons > div:nth-of-type(2)";
const SHARE = "#share";
const PERMITTED = async () => ({ permitted: true as const });

/** A store coupon whose press collects it, and a Share button whose press changes nothing on the page. */
function store(start: { collected: boolean } = { collected: false }): { runtime: WebAutomationLlmEvidenceRuntime; commands: string[] } {
  let collected = start.collected;
  const commands: string[] = [];
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push(command.actionType);
      if (command.actionType === "web.dom.click") {
        if (command.parameters.selector === COUPON) collected = true;
        return { status: "succeeded" };
      }
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const elements: JsonObject[] = [
        { tagName: "h2", selector: "#coupons > h2", visibleText: "Store coupons" },
        { tagName: "button", selector: SHARE, visibleText: "Share" },
        { tagName: "div", selector: COUPON, visibleText: collected ? "Collected" : "Get coupons", hasClickHandler: true, classNames: collected ? ["b", "x"] : ["b"], attributes: { class: collected ? "b x" : "b" } }
      ];
      return { status: "succeeded", payload: { snapshot: { url: URL_, title: "Item", interactiveElements: elements } } };
    }
  });
  return { runtime, commands };
}

let calls = 0;
async function run(runtime: WebAutomationLlmEvidenceRuntime, node: string, parameters: JsonObject) {
  calls += 1;
  return await runtime.executeTool({ ...SCOPE, callId: `call.${calls}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node, parameters, consequences: [] } });
}

/** The route state the host's `observeRouteState` reads of a page, as a look reports it. */
async function routeStateOf(runtime: WebAutomationLlmEvidenceRuntime): Promise<JsonObject> {
  const looked = await run(runtime, LOOK, {});
  assert.ok(looked.routeState, "a look reports the route state of the page it left");
  return looked.routeState;
}

/** A candidate submission's resolution, or with `legacy` one that asks for no view history. */
async function candidate(runtime: WebAutomationLlmEvidenceRuntime, handle: string, legacy = false) {
  const asked = { ...SCOPE, nodeDefinitionId: CLICK, parameters: { target: { handle } }, declaredConsequences: ["create_new" as const], permission: PERMITTED };
  return await runtime.resolvePlanNodeParameters(legacy ? asked : { ...asked, handleReach: "view_history" });
}

/** Exploration as R4b's: look, collect the coupon, look again. Returns the coupon's handle. */
async function explored(runtime: WebAutomationLlmEvidenceRuntime): Promise<string> {
  const looked = await run(runtime, LOOK, {});
  const coupon = shownHandle(looked.evidence, "Get coupons");
  const pressed = await run(runtime, CLICK, { target: { handle: coupon } });
  assert.equal((pressed.evidence as { pageChanged?: boolean }).pageChanged, true);
  await run(runtime, LOOK, {});
  return coupon;
}

test("a candidate's step on the coupon exploration collected carries what the press made true, which holds only where the coupon is collected", async () => {
  const { runtime } = store();
  const coupon = await explored(runtime);
  const resolved = await candidate(runtime, coupon);
  assert.equal(resolved.status, "resolved", JSON.stringify(resolved));
  if (resolved.status !== "resolved") return;
  // t442's identity is unchanged: the control as the press found it.
  assert.equal((resolved.parameters.element as JsonObject).visibleText, "Get coupons");
  const effect = resolved.effect;
  assert.ok(effect, "the step carries its effect");
  // Hashes only: neither the act's words nor the control's address leave as the effect.
  assert.equal(effect.v, "web-effect.v1");
  assert.ok(!JSON.stringify(effect).includes("Collected") && !JSON.stringify(effect).includes(COUPON));
  assert.ok(JSON.stringify(effect).length <= 2_048, "within Core's signature bound");

  assert.equal(webAutomationRouteEffectHolds(effect, await routeStateOf(store({ collected: true }).runtime)), true, "a page that already holds the coupon shows it");
  assert.equal(webAutomationRouteEffectHolds(effect, await routeStateOf(store().runtime)), false, "a fresh page does not");
});

test("no effect is answered where no act's identity is: exploration's own resolution, a legacy one, a control nothing changed", async () => {
  const { runtime } = store();
  const coupon = await explored(runtime);
  const exploring = await runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: CLICK, parameters: { target: { handle: coupon } }, gatedByCaller: true });
  assert.equal(exploring.status, "resolved");
  assert.equal(Object.hasOwn(exploring, "effect"), false);
  // Against the page as it now is the agreed identity is wordless, which t442's floor refuses; resolved or not, no effect.
  const legacy = await candidate(runtime, coupon, true);
  assert.equal(Object.hasOwn(legacy, "effect"), false, JSON.stringify(legacy));

  // Share's press changed no control on the page: there is nothing its step could be passed over for.
  const share = shownHandle((await run(runtime, LOOK, {})).evidence, "Share");
  const pressed = await run(runtime, CLICK, { target: { handle: share } });
  assert.deepEqual(pressed.routeState, await routeStateOf(runtime), "the page the press left is the page as it was");
  const unchanged = await candidate(runtime, share);
  assert.equal(unchanged.status, "resolved", JSON.stringify(unchanged));
  assert.equal(Object.hasOwn(unchanged, "effect"), false);
});

test("the build test's check answers `present` for a step whose effect the page shows, and acts on nothing", async () => {
  const { runtime } = store();
  const coupon = await explored(runtime);
  const resolved = await candidate(runtime, coupon);
  if (resolved.status !== "resolved" || !resolved.effect) throw new Error(JSON.stringify(resolved));
  // R4b's saved step: a wordless identity, which the page's "Collected" div still answers to.
  const parameters = { selector: COUPON, element: { tagName: "div", classNames: ["b"] } };
  const check = async (page: { collected: boolean }, effect?: JsonObject) => {
    const stubbed = store(page);
    const value: JsonObject = { replay: "verify", node: CLICK, parameters, consequences: ["create_new"], from: { location: URL_ } };
    if (effect) value.effect = effect;
    const answered = await stubbed.runtime.executeTool({ ...SCOPE, callId: `dryrun.${(calls += 1)}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value });
    assert.equal(answered.effectApplied, false);
    assert.equal(stubbed.commands.includes("web.dom.click"), false, "a check presses nothing");
    return answered.resultCode;
  };
  assert.equal(await check({ collected: true }, resolved.effect), "core.replay.present");
  // Without its effect the check reads only the control, which answers: `verified`, R4b's wrong answer.
  assert.equal(await check({ collected: true }), "core.replay.verified");
  // An effect the page does not show says nothing: the check goes on and finds the control.
  assert.equal(await check({ collected: false }, resolved.effect), "core.replay.verified");
});
