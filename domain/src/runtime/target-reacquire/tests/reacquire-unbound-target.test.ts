// The web host's source-less refind (`../reacquire-unbound-target.ts`) on a stepper whose next
// step holds the control a saved press is for (F23, `run-mwov0vf8-41ab862a`): the refind only
// says `gone` from a complete, same-place look at the document the failed attempt was on, so a
// control that is really there under a new address is found again, and one the page never
// brought (the stepper still on its earlier step) is truly not there. A wrong frame, a changed
// document or an incomplete look is never read as gone. A permit application stands in,
// unrelated to any realistic scenario.

import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationStudioHostStateSnapshotRef, AutomationStudioUnboundTargetReacquireRequest } from "fluxiq/automation";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../output-nodes";
import { webResetResource } from "../../llm-evidence/control-spot";
import type { WebAutomationHostRuntimeGateway } from "../../host-runtime";
import { createWebTargetPlaces, type WebTargetCaptureProvenance, type WebTargetScope } from "../identity";
import { webAutomationReacquireUnboundTarget } from "../reacquire-unbound-target";

const CLICK = webAutomationOutputNodeId("web.dom.click");
const SESSION = "paired.one";
const LOCATION = "https://permits.test/apply";
const CHILD_LOCATION = "https://permits.test/stepper";
/** The option the saved step presses: on the stepper's second step only. */
const OPTION = { tagName: "button", role: "button", accessibleName: "Parking permit", visibleText: "Parking permit", testId: "permit-kind" };
/** What the stepper's first step shows instead. */
const FIRST_STEP = [
  { tagName: "button", role: "button", accessibleName: "North office", visibleText: "North office", testId: "office", selector: "#office-north", attributes: { "data-testid": "office" } },
  { tagName: "button", role: "button", accessibleName: "Continue", visibleText: "Continue", testId: "continue", selector: "#continue", attributes: { "data-testid": "continue" } }
];
const SECOND_STEP = [{ ...OPTION, selector: "#permit-kind-fresh", attributes: { "data-testid": "permit-kind" } }];

type Reply = Awaited<ReturnType<WebAutomationHostRuntimeGateway["dispatch"]>>;

function snapshot(frame: number, elements: JsonObject[], changes: JsonObject = {}): JsonObject {
  const count = elements.length;
  return {
    url: frame === 0 ? LOCATION : CHILD_LOCATION,
    frame: { isTop: frame === 0 },
    interactiveElements: elements,
    evidence: {
      elements: { scanned: count, candidates: count, matched: count, returned: count, truncated: false },
      loading: { documentState: "complete", busy: false, pendingNavigation: false },
      navigation: { timeOrigin: frame === 0 ? 10 : 20 },
      captureOptions: { includeHidden: true }
    },
    ...changes
  };
}

function reply(frame: number, elements: JsonObject[], changes: JsonObject = {}, answeredBy = frame): Reply {
  return { ok: true, status: "succeeded", outputId: "web.dom.capture_snapshot", metadata: { sessionId: SESSION }, payload: { result: { snapshot: snapshot(frame, elements, changes), sourceId: `tab:17:frame:${answeredBy}` } } } as Reply;
}

/** The provenance the failed attempt's own before-action capture proved, kept as the host keeps it. */
function provenance(frame: number): WebTargetCaptureProvenance {
  return {
    scope: { kind: frame === 0 ? "merged" : "single-frame", sessionId: SESSION, browserTabId: 17, browserFrameId: frame, ...(frame === 0 ? {} : { browserFrameUrlPath: "/stepper" }), resetResource: webResetResource(SESSION, `tab:17:frame:${frame}`)!, location: frame === 0 ? LOCATION : CHILD_LOCATION, timeOrigin: frame === 0 ? 10 : 20 },
    coverage: "complete",
    includesHidden: true
  };
}

const STATE: AutomationStudioHostStateSnapshotRef = { stateRef: "web.state.1@pick.attempt.3:before_action", stateSnapshotId: "web.state.1", capturedAt: 1 };

function places(frame: number) {
  const kept = createWebTargetPlaces();
  kept.keep(STATE, provenance(0));
  kept.bind("pick.attempt.3", STATE);
  if (frame !== 0) {
    // The scope the step asks for, as the host keys the attempt's own scoped capture by it.
    const scope: WebTargetScope = { kind: "single-frame", browserTabId: 17, browserFrameId: frame, browserFrameUrlPath: "/stepper" };
    kept.keepScoped("pick.attempt.3", STATE, scope, provenance(frame));
  }
  return kept;
}

function request(frame: number): AutomationStudioUnboundTargetReacquireRequest {
  const parameters: JsonObject = { selector: "#permit-kind-old", element: { ...OPTION, selector: "#permit-kind-old" }, browserTabId: 17, ...(frame === 0 ? {} : { browserFrameId: frame, browserFrameUrlPath: "/stepper" }) };
  return {
    node: { id: "pick", definitionId: CLICK, definitionVersion: "1", parameterValues: parameters },
    parameters,
    refresh: { container: "node", definitionId: CLICK, definitionVersion: "1", parameterIds: ["selector", "element"], removableParameterIds: ["selector", "element"] },
    previousAttempt: { attemptId: "pick.attempt.3", beforeAction: STATE },
    failure: { category: "target_not_found", code: "web.target.not_found", retryable: true, effect: "unacted" }
  };
}

async function refind(frame: number, answer: Reply) {
  const sent: JsonObject[] = [];
  const dispatch: WebAutomationHostRuntimeGateway["dispatch"] = async (call) => {
    sent.push(call.payload);
    return answer;
  };
  return { answer: await webAutomationReacquireUnboundTarget(request(frame), places(frame), dispatch), sent };
}

for (const frame of [0, 4]) {
  const where = frame === 0 ? "top document" : "proven child frame";
  test(`${where}: the option re-rendered under a new address on its own step is found again by identity`, async () => {
    const { answer, sent } = await refind(frame, reply(frame, SECOND_STEP));
    assert.equal(answer.outcome, "found");
    if (answer.outcome !== "found") return;
    assert.deepEqual(answer.patches[0], { operation: "set", parameterId: "selector", value: "#permit-kind-fresh" });
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.browserFrameId, frame);
  });

  test(`${where}: a stepper still on its earlier step never brought the option, and a complete same-place look says so`, async () => {
    const { answer } = await refind(frame, reply(frame, FIRST_STEP));
    assert.deepEqual(answer, { outcome: "gone", coverage: "complete" });
  });

  test(`${where}: an incomplete look is never read as gone`, async () => {
    const busy = { evidence: { ...(snapshot(frame, FIRST_STEP).evidence as JsonObject), loading: { documentState: "loading", busy: true, pendingNavigation: false } } };
    const cut = { evidence: { ...(snapshot(frame, FIRST_STEP).evidence as JsonObject), elements: { scanned: 9, candidates: 9, matched: 2, returned: 2, truncated: true } } };
    for (const changes of [busy, cut]) assert.deepEqual((await refind(frame, reply(frame, FIRST_STEP, changes))).answer, { outcome: "unavailable", reason: "observation_incomplete" });
  });

  test(`${where}: another document in the same place, or another frame's answer, is never read as gone`, async () => {
    const reloaded = { evidence: { ...(snapshot(frame, FIRST_STEP).evidence as JsonObject), navigation: { timeOrigin: 99 } } };
    assert.deepEqual((await refind(frame, reply(frame, FIRST_STEP, reloaded))).answer, { outcome: "unavailable", reason: "place_unproved" });
    assert.deepEqual((await refind(frame, reply(frame, SECOND_STEP, {}, frame + 1))).answer, { outcome: "unavailable", reason: "place_unproved" });
  });
}

test("a child frame without its own complete scoped prior capture is never refound or read as gone", async () => {
  const kept = createWebTargetPlaces();
  kept.keep(STATE, provenance(0));
  kept.bind("pick.attempt.3", STATE);
  let reads = 0;
  const answer = await webAutomationReacquireUnboundTarget(request(4), kept, async () => {
    reads += 1;
    return reply(4, SECOND_STEP);
  });
  assert.deepEqual(answer, { outcome: "unavailable", reason: "place_unproved" });
  assert.equal(reads, 0);
});
