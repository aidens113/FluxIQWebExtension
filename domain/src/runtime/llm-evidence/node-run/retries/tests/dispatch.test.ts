// Every node a build runs against the live page keeps Core's default retries:
// the first attempt and three more (t355, the user's rule of 2026-10-07).
//
// Built from lane A round 4 (`run-muyrpbnk-fef374e7`): exploration's press on
// crossborder's "Get coupons" came back `page_busy_try_later` -- the page wrote
// "Network busy, please try again" -- at step 0014, with nothing tried again.
// The page is stubbed at the gateway, where the domain meets it, and answers
// with the records the extension really sends (`content/action-runtime/
// results.ts`, built from the closed set's rows).

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { AUTOMATION_STUDIO_DEFAULT_NODE_RETRY_POLICY } from "fluxiq/automation-studio";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord, type WebAutomationFailureCode } from "../../../../failure";
import { shownHandle } from "../../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const ITEM = "https://crossborder.example.test/item/1005008123450";
const PERMITTED = async () => ({ permitted: true as const });

type Packet = JsonObject & { ok?: boolean; code?: string; attempts?: number };

/** The record the extension sends for a code, as `results.ts` builds it. */
function failed(code: WebAutomationFailureCode): { status: string; failure: JsonObject; error: string } {
  const failure = webAutomationFailureRecord(code, { expected: "the press", actual: "not yet" });
  return { status: "failed", failure: failure as unknown as JsonObject, error: code };
}

/**
 * The item page, whose coupon press answers `answers` in turn and then
 * succeeds. Counts every command the press sent.
 */
function itemPage(answers: ReadonlyArray<ReturnType<typeof failed>>) {
  const presses: number[] = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.click") {
        presses.push(presses.length + 1);
        const answer = answers[presses.length - 1];
        return answer ?? { status: "succeeded", payload: { value: "ok" } };
      }
      return { status: "succeeded", payload: { snapshot: page() } };
    }
  };
  return { gateway, presses };
}

function page(): JsonObject {
  return {
    url: ITEM,
    title: "Voltbay USB C Hub",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
    interactiveElements: [
      { tagName: "button", selector: "#coupon", visibleText: "Get coupons" },
      { tagName: "button", selector: "#add", visibleText: "Add to cart" }
    ]
  };
}

async function pressCoupon(gateway: WebLlmEvidenceGateway, consequences: string[] = []) {
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const coupon = shownHandle(looked.evidence, "Get coupons");
  return await runtime.executeTool({ ...PROJECT, callId: "collect.coupon", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { node: CLICK, parameters: { target: { handle: coupon } }, consequences } });
}

test("the default is Core's: the first attempt and three retries", () => {
  assert.equal(AUTOMATION_STUDIO_DEFAULT_NODE_RETRY_POLICY.maxAttempts, 4);
});

test("an exploring press the page turned away as busy is made again once the refusal clears, and the model sees the press that landed", async () => {
  const site = itemPage([failed(WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED)]);
  const pressed = await pressCoupon(site.gateway);
  assert.equal(pressed.resultCode, "web.action.succeeded");
  assert.equal(pressed.effectApplied, true);
  assert.deepEqual(site.presses, [1, 2]);
  assert.equal((pressed.evidence as Packet).attempts, 2);
});

test("an exploring press whose target appears before the third retry succeeds on the fourth attempt", async () => {
  const notYet = failed(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND);
  const site = itemPage([notYet, notYet, notYet]);
  const pressed = await pressCoupon(site.gateway);
  assert.equal(pressed.resultCode, "web.action.succeeded");
  assert.deepEqual(site.presses, [1, 2, 3, 4]);
  assert.equal((pressed.evidence as Packet).attempts, 4);
});

test("an exploring press whose target never appears fails after exactly four attempts, and says so", async () => {
  const notYet = failed(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND);
  const site = itemPage([notYet, notYet, notYet, notYet, notYet]);
  const pressed = await pressCoupon(site.gateway);
  assert.equal(pressed.effectApplied, false);
  assert.equal((pressed.evidence as Packet).ok, false);
  assert.deepEqual(site.presses, [1, 2, 3, 4]);
  assert.equal((pressed.evidence as Packet).attempts, 4);
});

// A press whose confirmation was lost after it acted is made again only when
// its call declared that nothing it does lasts (`consequences: none`, Core's
// `declared-no-lasting-act.ts`): the user's rule retries every node and holds
// back only a lasting act whose effect is uncertain.
test("an exploring press whose confirmation was lost after it acted is not pressed again when it declared a lasting act", async () => {
  const site = itemPage([failed(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED), failed(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED)]);
  const pressed = await pressCoupon(site.gateway, ["modify_existing"]);
  assert.equal(pressed.effectApplied, false);
  assert.deepEqual(site.presses, [1]);
  assert.equal((pressed.evidence as Packet).attempts, undefined);
});

test("an exploring press that declared nothing lasting is pressed again when its confirmation was lost", async () => {
  const site = itemPage([failed(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED), failed(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED)]);
  const pressed = await pressCoupon(site.gateway);
  assert.equal(pressed.resultCode, "web.action.succeeded");
  assert.deepEqual(site.presses, [1, 2, 3]);
});

test("a press answered once as a first attempt says no attempts at all", async () => {
  const site = itemPage([]);
  const pressed = await pressCoupon(site.gateway);
  assert.equal(pressed.resultCode, "web.action.succeeded");
  assert.deepEqual(site.presses, [1]);
  assert.equal((pressed.evidence as Packet).attempts, undefined);
});

test("a replayed press in the build's test is made again after a busy refusal, as playback makes it", async () => {
  const site = itemPage([failed(WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED)]);
  const runtime = createWebAutomationLlmEvidenceRuntime(site.gateway);
  const replayed = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#coupon" }, consequences: [], from: { location: ITEM } } });
  assert.equal(replayed.resultCode, "core.replay.replayed");
  assert.deepEqual(site.presses, [1, 2]);
});

test("a replayed press whose target the page draws late is pressed, not called remembered on the first look", async () => {
  // The page has not drawn the coupon control at the first two looks.
  let looks = 0;
  const presses: string[] = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.click") {
        presses.push(String(command.parameters.selector));
        return { status: "succeeded", payload: { value: "ok" } };
      }
      looks += 1;
      const drawn = page();
      if (looks <= 2) drawn.interactiveElements = [{ tagName: "button", selector: "#add", visibleText: "Add to cart" }];
      return { status: "succeeded", payload: { snapshot: drawn } };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const replayed = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, consequences: [], from: { location: ITEM },
      parameters: { selector: "#coupon-late", element: { tagName: "button", visibleText: "Get coupons", selector: "#coupon-late" } } } });
  assert.equal(replayed.resultCode, "core.replay.replayed");
  assert.deepEqual(presses, ["#coupon-late"]);
});
