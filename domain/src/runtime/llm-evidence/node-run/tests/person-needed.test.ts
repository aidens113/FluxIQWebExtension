// A call that meets a robot check is the person's, never the model's.
//
// The client answers `USER_INTERVENTION_REQUIRED` when a navigation lands on a
// check, a press finds one in its way, or a look is taken of one. Core never
// shows such a result to the model: it asks the person to clear the check and
// press Continue, and on Continue the call stands with the draft statement it
// carries (`AS/runtime/llm/evidence-loop/tool-execution.ts`). So the call is
// marked `personNeeded`, and its draft is the step as it stands once cleared:
// a navigation or a press that went out proposes itself, a look proposes
// nothing. Every other failure is reported exactly as before.
//
// Before t197 a check came back as an ordinary `needs_person` refusal, and a
// model told "that failed" knocked on it until it was locked out
// (`run-munp80f5-c31ea417`).

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_FAILURE_CODES } from "../../../failure";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";

const PROJECT = { projectId: "project.one", flowId: "flow.one", maxEvidenceBytes: 8_000 };
const HOME = "https://store.test/home";
const NEXT = "https://store.test/next";
const NAVIGATE = "web.output.browser-navigate";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const CLICK = "web.output.dom-click";
const PERMITTED = async () => ({ permitted: true as const });
const CHECK = { code: WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED, actual: "captcha: a robot check" };

type Fails = { navigate?: JsonObject; click?: JsonObject; capture?: JsonObject; captureAfterClick?: JsonObject };

/** A page with one button, whose navigation, press or look can each be made to fail with a given record. */
function site(fails: Fails, options: { blank?: boolean } = {}) {
  const state = { location: options.blank ? undefined as string | undefined : HOME, clicked: false };
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") {
        if (fails.capture) return { status: "failed", failure: fails.capture, error: "no" };
        if (state.clicked && fails.captureAfterClick) return { status: "failed", failure: fails.captureAfterClick, error: "no" };
        if (state.location === undefined) return { status: "failed", error: "blank tab" };
        return { status: "succeeded", payload: { snapshot: page(state.location) } };
      }
      if (command.actionType === "web.browser.navigate") {
        if (fails.navigate) return { status: "failed", failure: fails.navigate, error: "no" };
        state.location = String(command.parameters.url);
        return { status: "succeeded", payload: { url: state.location } };
      }
      if (command.actionType === "web.dom.click") {
        if (fails.click) return { status: "failed", failure: fails.click, error: "no" };
        state.clicked = true;
        return { status: "succeeded" };
      }
      return { status: "succeeded" };
    }
  };
  return { gateway, runtime: createWebAutomationLlmEvidenceRuntime(gateway) };
}

function page(url: string): JsonObject {
  return {
    url,
    title: "Store",
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [{ tagName: "button", selector: "#go", visibleText: "Go", attributes: { type: "button" }, bounds: { x: 1, y: 1, width: 10, height: 10 } }]
  };
}

async function goHandle(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>): Promise<string> {
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const element = (looked.evidence as { elements: Array<{ target: string; text?: string }> }).elements.find((candidate) => candidate.text === "Go");
  assert.ok(element, "the button is in the packet");
  return element.target;
}

test("a navigation that lands on a robot check needs a person, and stands as a proposing navigation", async () => {
  const { runtime } = site({ navigate: CHECK });
  const went = await runtime.executeTool({ ...PROJECT, callId: "call.go", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: NAVIGATE, parameters: { url: NEXT }, consequences: [] } });

  assert.equal(went.personNeeded, true);
  // The run's record keeps the refusal it was.
  assert.equal(went.effectApplied, false);
  assert.equal(went.resultCode, "web.action.rejected.needs_person");
  assert.equal(went.resultReason, undefined);
  assert.deepEqual(went.draft, {
    actionId: NAVIGATE,
    effect: "mutate",
    input: { node: NAVIGATE, parameters: { url: NEXT }, consequences: [] },
    ranWith: { node: NAVIGATE, parameters: { url: NEXT }, consequences: [] },
    proposes: true,
    replay: { from: { location: HOME } }
  });
});

test("the Flow's first navigation, from nowhere, onto a check stands with where it was sent", async () => {
  const { runtime } = site({ navigate: CHECK }, { blank: true });
  const went = await runtime.executeTool({ ...PROJECT, callId: "call.go", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: NEXT, value: { node: NAVIGATE, parameters: { url: NEXT }, consequences: [] } });

  assert.equal(went.personNeeded, true);
  assert.equal(went.draft?.proposes, true);
  assert.equal(went.draft?.effect, "mutate");
  assert.deepEqual(went.draft?.replay, { from: { location: NEXT } });
});

test("a press that meets a robot check needs a person, and stands as a proposing press", async () => {
  const { runtime } = site({ click: CHECK });
  const handle = await goHandle(runtime);
  const pressed = await runtime.executeTool({ ...PROJECT, callId: "call.press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle } }, consequences: [] } });

  assert.equal(pressed.personNeeded, true);
  assert.equal(pressed.resultCode, "web.action.rejected.needs_person");
  assert.equal(pressed.draft?.actionId, CLICK);
  assert.equal(pressed.draft?.effect, "mutate");
  assert.equal(pressed.draft?.proposes, true);
  assert.deepEqual(pressed.draft?.input, { node: CLICK, parameters: { target: { handle } }, consequences: [] });
  // What the Flow keeps is what the press ran with: the resolved control, not the handle.
  assert.equal((pressed.draft?.ranWith?.parameters as JsonObject).selector, "#go");
  assert.deepEqual(pressed.draft?.replay, { from: { location: HOME } });
});

test("a press that worked, whose page then shows a robot check, stands as a proposing press", async () => {
  const { runtime } = site({ captureAfterClick: CHECK });
  const handle = await goHandle(runtime);
  const pressed = await runtime.executeTool({ ...PROJECT, callId: "call.press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle } }, consequences: [] } });

  assert.equal(pressed.personNeeded, true);
  assert.equal(pressed.draft?.effect, "mutate");
  assert.equal(pressed.draft?.proposes, true);
  assert.deepEqual(pressed.draft?.replay, { from: { location: HOME } });
});

test("a look at a robot check needs a person and proposes nothing", async () => {
  const { runtime } = site({ capture: CHECK });
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });

  assert.equal(looked.personNeeded, true);
  assert.equal(looked.resultCode, "web.action.rejected.needs_person");
  assert.equal(looked.draft?.effect, "observe");
  assert.equal(looked.draft?.proposes, false);
  assert.equal(looked.draft?.ranWith, undefined);
  assert.equal(looked.draft?.replay, undefined);
});

test("a press whose own look before acting meets a check proposes nothing, because nothing went out", async () => {
  const { runtime } = site({ capture: CHECK });
  const pressed = await runtime.executeTool({ ...PROJECT, callId: "call.press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle: "target.1" } }, consequences: [] } });

  assert.equal(pressed.personNeeded, true);
  assert.equal(pressed.draft?.effect, "observe");
  assert.equal(pressed.draft?.proposes, false);
});

test("ordinary failures are unchanged: a dialog, and a sign-in, are the model's to hear and need no Continue", async () => {
  for (const [failure, code] of [
    [{ code: WEB_AUTOMATION_FAILURE_CODES.BLOCKED_BY_DIALOG, actual: "covered: x" }, "web.action.rejected.blocked_by_dialog"],
    [{ code: WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED }, "web.action.rejected.needs_person"],
    [{ code: WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND }, "web.action.rejected.target_not_found"]
  ] as const) {
    const { runtime } = site({ click: failure });
    const handle = await goHandle(runtime);
    const pressed = await runtime.executeTool({ ...PROJECT, callId: "call.press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle } }, consequences: [] } });

    assert.equal(Object.hasOwn(pressed, "personNeeded"), false, code);
    assert.equal(pressed.resultCode, code);
    assert.equal(pressed.effectApplied, false);
    // A failed step is still not replayable and says nothing it ran with.
    assert.equal(pressed.draft?.replay, undefined, code);
    assert.equal(pressed.draft?.ranWith, undefined, code);
  }
});

test("a replayed step that lands on a robot check stays core.replay.failed and says a person is needed", async () => {
  const { runtime } = site({ click: CHECK });
  const replayed = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [] }
  });

  assert.equal(replayed.resultCode, "core.replay.failed");
  assert.equal(replayed.personNeeded, true);
  assert.equal(replayed.draft, undefined);
});

test("a replay reset that lands on a robot check says a person is needed", async () => {
  const { runtime } = site({ navigate: CHECK });
  const reset = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.reset", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "reset", from: { location: HOME } }
  });

  assert.equal(reset.resultCode, "core.replay.reset_failed");
  assert.equal(reset.personNeeded, true);
});

test("an ordinary replay failure carries no person-needed mark", async () => {
  const { runtime } = site({ click: { code: WEB_AUTOMATION_FAILURE_CODES.TARGET_AMBIGUOUS } });
  const replayed = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [] }
  });
  assert.equal(replayed.resultCode, "core.replay.failed");
  assert.equal(Object.hasOwn(replayed, "personNeeded"), false);
});
