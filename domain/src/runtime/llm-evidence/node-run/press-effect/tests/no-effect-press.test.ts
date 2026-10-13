// A press that changed nothing is never answered as a success, through the
// real runtime (t511).
//
// Classifieds step 0038 of `run-mv6qrcdu-a31b44b8`: Apply inside an open
// dialog was pressed, the dialog stayed open and nothing in it changed, and the
// answer was `status: "succeeded"`, `pageChanged: true` -- because the look
// after it was scrolled 19 pixels further, and the whole packet was compared.
// The model went on as if the setting had been applied.
//
// A generic settings dialog stands in for it: a size select, Cancel and Save,
// on a page that scrolls a little with every press.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { shownHandle } from "../../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const PAGE = "https://settings.test/preferences";

type State = { scrollY: number; open: boolean; bold: boolean };

test("Save in an open dialog that changed nothing, pressed twice, is reported as no effect, never as succeeded", async () => {
  const page = stub(() => undefined);
  const runtime = createWebAutomationLlmEvidenceRuntime(page.gateway);
  const save = shownHandle((await look(runtime)).evidence, "Save");
  const pressed = (await press(runtime, save)).evidence as JsonObject;
  assert.equal(pressed.status, "no_effect");
  assert.notEqual(pressed.pageChanged, true);
  assert.match(String(pressed.noEffect), /pressed twice/u);
  assert.match(String(pressed.noEffect), /"Display settings" it is in is still open/u);
  assert.equal("unchangedPress" in pressed, false);
  // The press's own retry came first: Save was pressed once more before the answer.
  assert.deepEqual(page.clicked, ["#save", "#save"]);
});

test("Save that only takes on the second press is answered as the second press's success, saying it was pressed again", async () => {
  const page = stub((state, presses) => (presses === 2 ? { ...state, open: false } : undefined));
  const runtime = createWebAutomationLlmEvidenceRuntime(page.gateway);
  const save = shownHandle((await look(runtime)).evidence, "Save");
  const pressed = (await press(runtime, save)).evidence as JsonObject;
  assert.equal(pressed.status, "succeeded");
  assert.equal(pressed.pageChanged, true);
  assert.match(String(pressed.pressedAgain), /changed nothing, so it was pressed once more/u);
  assert.equal("noEffect" in pressed, false);
  assert.deepEqual(page.clicked, ["#save", "#save"]);
});

test("a press whose call declared a lasting consequence is not pressed again, and still says it had no effect", async () => {
  const page = stub(() => undefined);
  const runtime = createWebAutomationLlmEvidenceRuntime(page.gateway);
  const save = shownHandle((await look(runtime)).evidence, "Save");
  const pressed = (await press(runtime, save, ["modify_existing"])).evidence as JsonObject;
  assert.equal(pressed.status, "no_effect");
  assert.doesNotMatch(String(pressed.noEffect), /twice/u);
  assert.deepEqual(page.clicked, ["#save"]);
});

test("a toggle whose only change is aria-pressed is a success, pressed once", async () => {
  const page = stub((state) => ({ ...state, bold: !state.bold }));
  const runtime = createWebAutomationLlmEvidenceRuntime(page.gateway);
  const bold = shownHandle((await look(runtime)).evidence, "Bold");
  const pressed = (await press(runtime, bold)).evidence as JsonObject;
  assert.equal(pressed.status, "succeeded");
  assert.equal("noEffect" in pressed, false);
  assert.equal("pressedAgain" in pressed, false);
  assert.deepEqual(page.clicked, ["#bold"]);
});

async function look(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>) {
  return runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
}

async function press(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>, handle: string, consequences: string[] = []) {
  return runtime.executeTool({ ...PROJECT, callId: `call.press.${handle}.${Math.random()}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle } }, consequences } });
}

/**
 * A preferences page with a settings dialog open. Every press scrolls it a
 * little; `onPress` says what else the press did (`undefined`: nothing), told
 * how many times the page has been pressed.
 */
function stub(onPress: (state: State, presses: number) => State | undefined) {
  let state: State = { scrollY: 151, open: true, bold: false };
  const clicked: string[] = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: snapshot(state) } };
      if (command.actionType === "web.dom.click") {
        clicked.push(String((command.parameters as { selector: string }).selector));
        const next = onPress(state, clicked.length) ?? state;
        state = { ...next, scrollY: state.scrollY + 19 };
      }
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return { gateway, clicked };
}

function snapshot(state: State): JsonObject {
  const raw = (tagName: string, selector: string, y: number, fields: JsonObject): JsonObject => {
    const bounds = { x: 100, y: y - state.scrollY, width: 160, height: 30 };
    return { tagName, selector, documentBounds: { ...bounds, y }, bounds, isVisibleOnViewport: bounds.y >= 0 && bounds.y < 720, ...fields };
  };
  const elements: JsonObject[] = [
    raw("h1", "h1", 200, { visibleText: "Preferences" }),
    raw("button", "#bold", 260, { accessibleName: "Bold", attributes: { "aria-pressed": state.bold ? "true" : "false" } })
  ];
  if (state.open) {
    elements.push(
      raw("div", "#settings", 320, { role: "dialog", accessibleName: "Display settings" }),
      raw("select", "#size", 360, { accessibleName: "Text size", selectedValue: "large", options: [{ value: "medium", label: "Medium" }, { value: "large", label: "Large" }], parent: 2 }),
      raw("button", "#cancel", 400, { accessibleName: "Cancel", parent: 2 }),
      raw("button", "#save", 400, { accessibleName: "Save", parent: 2 })
    );
  }
  return {
    url: PAGE,
    title: "Preferences",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: state.scrollY, documentWidth: 1280, documentHeight: 2000, devicePixelRatio: 1 },
    evidence: state.open ? { dialogs: { open: [{ selector: "#settings", role: "dialog", label: "Display settings", modal: false }] } } : {},
    interactiveElements: elements
  };
}
