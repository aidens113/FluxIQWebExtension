// A saved step that ran inside a child frame is replayed in that frame on a later attempt, found again by its
// document's path, never by the frame id the build saw (t1062).
//
// The browser gives a frame a new id each time its document loads, and a later attempt reloads the start page, so
// the id saved on the step (`browserFrameId`) names another frame or none. The extension already chooses the frame
// by `browserFrameUrlPath` and lets the id only break a tie (`apps/extension/src/runtime/frame-address.ts`); the
// host's own reads of that frame must agree, or the step's before-action read is refused as another document and
// its stale target can never be found again there. Until t1062 they compared the stale id and refused.

import assert from "node:assert/strict";
import test from "node:test";
import { captured } from "./host/captured";
import type { JsonObject } from "fluxiq/core";
import type { AutomationStudioUnboundTargetReacquireRequest } from "fluxiq/runtime/automation-host";
import { webAutomationOutputNodeId } from "../../output-nodes";
import { createWebAutomationHostRuntime, type WebAutomationHostRuntimeGateway } from "../host-runtime";

const CLICK_NODE_ID = webAutomationOutputNodeId("web.dom.click");
const SLOT = { tagName: "button", role: "button", accessibleName: "13:00", visibleText: "13:00", testId: "slot-tue-1300" };
const WIDGET_PATH = "/widget/slotwise";
/** The id the build saw the widget's frame under, saved on the step. */
const SAVED_FRAME_ID = 4;
/** The id the browser gave the same frame after the later attempt reloaded the page. */
const RELOADED_FRAME_ID = 9;

type Reply = Awaited<ReturnType<WebAutomationHostRuntimeGateway["dispatch"]>>;
type Request = Parameters<WebAutomationHostRuntimeGateway["dispatch"]>[0];

function snapshot(frame: number): JsonObject {
  return {
    url: frame === 0 ? "https://heating.test/book" : `https://widget.test${WIDGET_PATH}`,
    frame: { isTop: frame === 0 },
    interactiveElements: frame === 0 ? [{ tagName: "main", selector: "main" }] : [{ ...SLOT, selector: "#fresh-slot", attributes: { "data-testid": SLOT.testId } }],
    evidence: {
      elements: { scanned: 1, candidates: 1, matched: 1, returned: 1, truncated: false },
      loading: { documentState: "complete", busy: false, pendingNavigation: false },
      navigation: { timeOrigin: frame === 0 ? 10 : 20 },
      captureOptions: { includeHidden: true }
    }
  };
}

/**
 * A tab whose widget frame is now `RELOADED_FRAME_ID`, choosing a frame as the extension does: by the path when the
 * command names one (one child frame is at it), otherwise by the id it names.
 */
function reloadedTab() {
  const sent: Request[] = [];
  const gateway: WebAutomationHostRuntimeGateway = {
    dispatch: async (request) => {
      sent.push(request);
      const path = request.payload.browserFrameUrlPath;
      const id = request.payload.browserFrameId;
      const frame = path === WIDGET_PATH ? RELOADED_FRAME_ID : typeof id === "number" ? id : 0;
      if (frame !== 0 && frame !== RELOADED_FRAME_ID) return { ok: false, outputId: request.outputId, status: "failed", error: "no such frame" } as Reply;
      return { ok: true, status: "succeeded", outputId: request.outputId, metadata: { sessionId: "paired.later" }, payload: { result: { snapshot: snapshot(frame), sourceId: `tab:17:frame:${frame}` } } };
    }
  };
  return { gateway, sent };
}

/** The saved step as the Flow holds it: its element in the widget's frame, with the frame's path and the old id. */
const savedStep = { id: "slot", definitionId: CLICK_NODE_ID, definitionVersion: "1", parameterValues: { selector: "#old-slot", element: SLOT, browserFrameUrlPath: WIDGET_PATH, browserFrameId: SAVED_FRAME_ID } };

function reacquireRequest(beforeAction: Awaited<ReturnType<typeof captured>>): AutomationStudioUnboundTargetReacquireRequest {
  return {
    node: savedStep, parameters: savedStep.parameterValues,
    refresh: { container: "node", definitionId: CLICK_NODE_ID, definitionVersion: "1", parameterIds: ["selector", "element"], removableParameterIds: ["selector", "element"] },
    previousAttempt: { attemptId: "slot.attempt.1", beforeAction },
    failure: { category: "target_not_found", code: "web.target.not_found", retryable: true, effect: "unacted" }
  };
}

test("a replayed frame step's stale target is found again in the frame at its path, though the browser renumbered it", async () => {
  const tab = reloadedTab();
  const boundary = createWebAutomationHostRuntime(tab.gateway);
  const before = await captured(boundary, { node: savedStep, attemptId: "slot.attempt.1", inputs: {}, point: "before_action" });
  const answer = await boundary.reacquireUnboundTarget!(reacquireRequest(before));
  assert.equal(answer.outcome, "found", JSON.stringify(answer));
  if (answer.outcome !== "found") return;
  assert.deepEqual(answer.patches[0], { operation: "set", parameterId: "selector", value: "#fresh-slot" });
  // The read that found it went to the frame the browser has now, by its path.
  const last = tab.sent.at(-1)!;
  assert.equal(last.outputId, "web.dom.capture_snapshot");
  assert.equal(last.payload.browserFrameUrlPath, WIDGET_PATH);
  assert.equal(last.payload.browserFrameId, RELOADED_FRAME_ID);
});

test("a frame at another path is still another document, whatever its id", async () => {
  const tab = reloadedTab();
  const boundary = createWebAutomationHostRuntime(tab.gateway);
  const elsewhere = { ...savedStep, parameterValues: { ...savedStep.parameterValues, browserFrameUrlPath: "/widget/other", browserFrameId: RELOADED_FRAME_ID } };
  const before = await captured(boundary, { node: elsewhere, attemptId: "slot.attempt.1", inputs: {}, point: "before_action" });
  const answer = await boundary.reacquireUnboundTarget!({ ...reacquireRequest(before), node: elsewhere, parameters: elsewhere.parameterValues });
  assert.equal(answer.outcome, "unavailable");
});
