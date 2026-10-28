// Every start-state read reports the page's shown values by their own place
// (t772 value witness), as it reports its stateful controls: how FluxIQ Core sees
// a value a press replaced set back. The site is a choir's rehearsal planner.

import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioActionPermissionDenied } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime } from "../..";
import type { WebLlmEvidenceGateway } from "../../capture";

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const request = { projectId: "project", flowId: "flow", callId: "start", permission: automationStudioActionPermissionDenied };

const planner = (room: string): JsonObject => ({
  url: "https://choir.test/planner",
  title: "Planner",
  interactiveElements: [
    { tagName: "p", selector: "#room", visibleText: room, bounds: box(0, 40, 200, 20) },
    { tagName: "p", selector: "#time", visibleText: "Thursdays at seven", bounds: box(0, 80, 200, 20) },
    { tagName: "button", selector: "#change", implicitRole: "button", visibleText: "Change room", bounds: box(0, 120, 120, 40) }
  ]
});

function runtimeOver(...snapshots: JsonObject[]) {
  let calls = 0;
  const gateway: WebLlmEvidenceGateway = { eligibleSessionIds: () => ["session"], executeAction: async () => {
    const snapshot = snapshots[Math.min(calls, snapshots.length - 1)]!;
    calls += 1;
    return { status: "succeeded", payload: { snapshot, sourceId: "tab:1:frame:0" } };
  } };
  return createWebAutomationLlmEvidenceRuntime(gateway);
}

test("each read names the page's shown values by place, so a replaced value and its return can be seen", async () => {
  const runtime = runtimeOver(planner("Room A"), planner("Room B"), planner("Room A"));
  const first = await runtime.startState!(request);
  const second = await runtime.startState!(request);
  const third = await runtime.startState!(request);
  const was = first?.values ?? {}, now = second?.values ?? {}, back = third?.values ?? {};
  assert.equal(Object.keys(was).length, 2, "the room and the time; the button is a control");
  assert.deepEqual(Object.keys(now), Object.keys(was));
  assert.equal(Object.keys(was).filter((place) => was[place] !== now[place]).length, 1, "only the room changed");
  assert.deepEqual(back, was, "the room set back reads as it did");
  assert.doesNotMatch(JSON.stringify(was), /Room|Thursday|Change/u);
});
