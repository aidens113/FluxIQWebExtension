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
import { shownHandle } from "../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const HOME = "https://store.test/home";
const NEXT = "https://store.test/next";
const NAVIGATE = "web.output.browser-navigate";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const CLICK = "web.output.dom-click";
const SELECT = "web.output.dom-select";
const PERMITTED = async () => ({ permitted: true as const });
const CHECK = { code: WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED, actual: "captcha: a robot check" };

type Fails = { navigate?: JsonObject; click?: JsonObject; capture?: JsonObject; captureAfterClick?: JsonObject; captureAfterSelect?: JsonObject; captureAfterRefusedClick?: JsonObject };

/** A page with one button and one choice, whose navigation, press, choice or look can each be made to fail with a given record. */
function site(fails: Fails, options: { blank?: boolean } = {}) {
  const state = { location: options.blank ? undefined as string | undefined : HOME, clicked: false, chose: false, refused: false };
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") {
        if (fails.capture) return { status: "failed", failure: fails.capture, error: "no" };
        if (state.clicked && fails.captureAfterClick) return { status: "failed", failure: fails.captureAfterClick, error: "no" };
        if (state.chose && fails.captureAfterSelect) return { status: "failed", failure: fails.captureAfterSelect, error: "no" };
        if (state.refused && fails.captureAfterRefusedClick) return { status: "failed", failure: fails.captureAfterRefusedClick, error: "no" };
        if (state.location === undefined) return { status: "failed", error: "blank tab" };
        return { status: "succeeded", payload: { snapshot: page(state.location) } };
      }
      if (command.actionType === "web.browser.navigate") {
        if (fails.navigate) return { status: "failed", failure: fails.navigate, error: "no" };
        state.location = String(command.parameters.url);
        return { status: "succeeded", payload: { url: state.location } };
      }
      if (command.actionType === "web.dom.click") {
        if (fails.click) {
          state.refused = true;
          return { status: "failed", failure: fails.click, error: "no" };
        }
        state.clicked = true;
        return { status: "succeeded" };
      }
      if (command.actionType === "web.dom.select") {
        state.chose = true;
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
    interactiveElements: [
      { tagName: "button", selector: "#go", visibleText: "Go", attributes: { type: "button" }, bounds: { x: 1, y: 1, width: 10, height: 10 } },
      // The link that shows the build the next page's address, which is what lets it navigate there (`../shown-addresses.ts`).
      { tagName: "a", selector: "#next", visibleText: "Next", href: NEXT, bounds: { x: 1, y: 20, width: 10, height: 10 } },
      { tagName: "select", selector: "#sort", accessibleName: "Sort by", selectedValue: "best", options: [{ value: "best", label: "Best match" }, { value: "rating", label: "Highest rating" }], bounds: { x: 1, y: 40, width: 40, height: 10 } }
    ]
  };
}

async function goHandle(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>): Promise<string> {
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  return shownHandle(looked.evidence, "Go");
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

// t885 (`run-mwaknxf9-7549d126`): a sort's reply came back from the old document, and the look after
// it met bigbox's "Robot or human?" page. The extension now answers that look USER_INTERVENTION_REQUIRED
// when the check does not clear by itself, so the choice stands as the act it was and the person is asked.
test("a choice that worked, whose look after it meets a robot check, needs a person and stands as a proposing choice", async () => {
  const { runtime } = site({ captureAfterSelect: CHECK });
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const handle = shownHandle(looked.evidence, "Sort by");
  const chosen = await runtime.executeTool({ ...PROJECT, callId: "call.sort", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SELECT, parameters: { target: { handle }, value: "Highest rating" }, consequences: [] } });

  assert.equal(chosen.personNeeded, true, JSON.stringify(chosen));
  assert.equal(chosen.resultCode, "web.action.rejected.needs_person");
  assert.equal(chosen.draft?.actionId, SELECT);
  assert.equal(chosen.draft?.effect, "mutate");
  assert.equal(chosen.draft?.proposes, true);
  assert.equal((chosen.draft?.ranWith?.parameters as JsonObject).selector, "#sort");
  assert.deepEqual(chosen.draft?.replay, { from: { location: HOME } });
});

// An action refused for its own reason, whose page is then a robot check, keeps the look's mark
// (`../../capture.ts`, `pageRefusal`): the person is next. The refusal keeps its own code, and the
// press stands as a press that met the check does, since its command went out.
test("a refused press whose page is then a robot check needs a person and keeps its refusal", async () => {
  const { runtime } = site({ click: { code: WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND }, captureAfterRefusedClick: CHECK });
  const handle = await goHandle(runtime);
  const pressed = await runtime.executeTool({ ...PROJECT, callId: "call.press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle } }, consequences: [] } });

  assert.equal(pressed.personNeeded, true, JSON.stringify(pressed));
  assert.equal(pressed.effectApplied, false);
  assert.equal(pressed.resultCode, "web.action.rejected.target_not_found");
  assert.equal(pressed.draft?.actionId, CLICK);
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
  const pressed = await runtime.executeTool({ ...PROJECT, callId: "call.press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle: "t1" } }, consequences: [] } });

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

// A press behind which a robot check stood still leaves its pre-act witness (t877, lane C w3,
// `run-mw46zf0k-e5977ea3`). Crossborder's price "OK" and "Price ↑" are drawn identically on every
// filter state of the results page, so Flow assembly, which reads the saved step's literal target
// against every view of it (`handleReach: "view_history"`), needs the record of the view the press
// acted from to tell which it was (`../../plan-resolution/control-intents/absolute.ts`). Without it
// the step stood in the Flow and the Flow was refused `web.handle.ambiguous`.

const RESULTS = "https://store.test/search?q=hub";
const FILTERED = "https://store.test/search?q=hub&max=10";
const SORTED = "https://store.test/search?q=hub&max=10&sort=price";
const SORT = "aside > div.sort > div";

/** A results page whose "OK" and "Price ↑" are drawn alike on every state; "OK" filters, "Price ↑" sorts, and either may meet a check. */
function results(fails: Fails) {
  const state = { location: RESULTS, clicked: false, cleared: false };
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") {
        if (state.clicked && fails.captureAfterClick && !state.cleared) return { status: "failed", failure: fails.captureAfterClick, error: "no" };
        return { status: "succeeded", payload: { snapshot: resultsPage(state.location) } };
      }
      if (command.actionType === "web.dom.click") {
        if (fails.click && !state.cleared) return { status: "failed", failure: fails.click, error: "no" };
        state.clicked = true;
        state.location = command.parameters.selector === SORT ? SORTED : FILTERED;
        return { status: "succeeded" };
      }
      return { status: "succeeded" };
    }
  };
  return { state, runtime: createWebAutomationLlmEvidenceRuntime(gateway) };
}

function resultsPage(url: string): JsonObject {
  return {
    url,
    title: "Search",
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [
      { tagName: "input", selector: "#max", attributes: { placeholder: "Max" }, bounds: { x: 1, y: 1, width: 40, height: 10 } },
      { tagName: "div", selector: "aside > div.price > div", visibleText: "OK", attributes: { role: "button" }, bounds: { x: 50, y: 1, width: 10, height: 10 } },
      { tagName: "div", selector: SORT, visibleText: "Price ↑", attributes: { role: "button" }, bounds: { x: 70, y: 1, width: 10, height: 10 } }
    ]
  };
}

type Runtime = ReturnType<typeof createWebAutomationLlmEvidenceRuntime>;
let resultCalls = 0;
async function call(runtime: Runtime, node: string, parameters: JsonObject) {
  resultCalls += 1;
  return await runtime.executeTool({ ...PROJECT, callId: `call.results.${resultCalls}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node, parameters, consequences: [] } });
}

/** The saved step resolved as Flow assembly resolves it: its literal target, against every view the build took. */
async function assembled(runtime: Runtime, pressed: Awaited<ReturnType<typeof call>>) {
  const ranWith = pressed.draft?.ranWith?.parameters as JsonObject | undefined;
  assert.ok(ranWith && typeof ranWith.selector === "string", "the press saved a resolved step");
  return await runtime.resolvePlanNodeParameters({ ...PROJECT, nodeDefinitionId: CLICK, parameters: ranWith, declaredConsequences: [], permission: PERMITTED, handleReach: "view_history" });
}

/** Press "OK", let the person clear any check it met, and look at two later states of the page. */
async function pressOk(fails: Fails) {
  const { state, runtime } = results(fails);
  const first = await call(runtime, SNAPSHOT, {});
  const pressed = await call(runtime, CLICK, { target: { handle: shownHandle(first.evidence, "OK") } });
  // The person clears the check and presses Continue; Core's look shows the filtered page, then the build sorts it.
  state.cleared = true;
  state.location = FILTERED;
  await call(runtime, SNAPSHOT, {});
  state.location = SORTED;
  await call(runtime, SNAPSHOT, {});
  return { runtime, first, pressed };
}

test("with no check, a press on a control every state draws resolves at assembly by its pre-act witness", async () => {
  const { runtime, pressed } = await pressOk({});
  assert.equal(pressed.personNeeded, undefined);
  const resolved = await assembled(runtime, pressed);
  assert.notEqual(resolved.status, "refused", JSON.stringify(resolved));
});

test("a press whose command met a robot check keeps its pre-act witness, so its step resolves at assembly", async () => {
  const { runtime, pressed } = await pressOk({ click: CHECK });
  assert.equal(pressed.personNeeded, true);
  assert.equal(pressed.draft?.proposes, true, "the step stands in the Flow");
  const resolved = await assembled(runtime, pressed);
  assert.notEqual(resolved.status, "refused", JSON.stringify(resolved));
});

test("a press whose look after it met a robot check keeps its pre-act witness, so its step resolves at assembly", async () => {
  const { runtime, pressed } = await pressOk({ captureAfterClick: CHECK });
  assert.equal(pressed.personNeeded, true);
  assert.equal(pressed.draft?.proposes, true, "the step stands in the Flow");
  const resolved = await assembled(runtime, pressed);
  assert.notEqual(resolved.status, "refused", JSON.stringify(resolved));
});

test("a press with a handle from before the check's reload is witnessed by the control it pressed on the fresh page", async () => {
  const { state, runtime } = results({ click: CHECK });
  const first = await call(runtime, SNAPSHOT, {});
  const stale = shownHandle(first.evidence, "Price ↑");
  await call(runtime, CLICK, { target: { handle: shownHandle(first.evidence, "OK") } });
  state.cleared = true;
  state.location = FILTERED;
  const fresh = await call(runtime, SNAPSHOT, {});
  assert.notEqual(shownHandle(fresh.evidence, "Price ↑"), stale, "the filtered page numbers its controls anew");
  // The model presses "Price ↑" by the handle the page before the check showed, as Core's stale current view offers it.
  const sorted = await call(runtime, CLICK, { target: { handle: stale } });
  assert.equal(sorted.effectApplied, true, JSON.stringify(sorted.evidence));
  assert.equal(state.location, SORTED);
  await call(runtime, SNAPSHOT, {});
  const resolved = await assembled(runtime, sorted);
  assert.notEqual(resolved.status, "refused", JSON.stringify(resolved));
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
