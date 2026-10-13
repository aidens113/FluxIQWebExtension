// A rerun keeps what the Flow saved, which the model never wrote (t432).
//
// What the model writes in a call names an element only by a handle the page
// view printed, or the call is refused. A repair or re-author round reads the
// Flow back as its draft, and a rerun merges what the model changed over a
// step's saved parameters -- the saved selector, element and list item. Those
// are the host's, carried under `held` by the round's opening look, and are
// not judged; whatever else the model writes in that round still is.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const PERMITTED = async () => ({ permitted: true as const });
const SNAPSHOT = "web.output.dom-capture_snapshot";
const CLICK = "web.output.dom-click";
const EXTRACT = "web.output.dom-extract_list";
const SAVED_ELEMENT: JsonObject = { tagName: "button", visibleText: "Renew", accessibleName: "Renew", testId: "renew" };
const SAVED_LIST: JsonObject = { item: "li.row", fields: { title: ".title" } };
/** The Flow the round continues: a press of Renew and a read of the rows, as saved. */
const HELD: JsonObject[] = [
  { node: CLICK, parameters: { selector: "#renew-saved", element: SAVED_ELEMENT }, consequences: [] },
  { node: EXTRACT, parameters: { extractList: SAVED_LIST }, consequences: [] }
];

// A press that lands counts on the page's status line, as a real page answers
// a press, so no press here is taken for one that changed nothing (t511) and
// pressed once more.
function site() {
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  let presses = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push({ actionType: command.actionType, parameters: command.parameters });
      if (command.actionType === "web.dom.capture_snapshot") {
        return { status: "succeeded", payload: { snapshot: { url: "https://example.test/tickets", title: "Tickets", interactiveElements: [{ tagName: "button", selector: "#renew", visibleText: "Renew", attributes: { "data-testid": "renew" } }, { tagName: "span", selector: "#status", visibleText: `Renewed ${presses} times` }] } } };
      }
      if (command.actionType === "web.dom.click") presses += 1;
      if (command.actionType === "web.dom.extract_list") {
        return { status: "succeeded", payload: { extracted: [{ title: "Row 1" }], extraction: { recordCount: 1, pagesRead: 1, itemsSeen: 1, truncated: false, fieldNames: ["title"], missingFields: [] } } };
      }
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return { runtime: createWebAutomationLlmEvidenceRuntime(gateway), commands };
}

type Site = ReturnType<typeof site>;

async function open(at: Site, held?: JsonObject[]) {
  const value: JsonObject = { node: SNAPSHOT, parameters: {}, consequences: [] };
  if (held) value.held = held;
  return await at.runtime.executeTool({ ...PROJECT, callId: `initial.${WEB_LLM_RUN_NODE_TOOL_ID}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value });
}

async function call(at: Site, callId: string, node: string, parameters: JsonObject) {
  return await at.runtime.executeTool({ ...PROJECT, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: { node, parameters, consequences: [] } });
}

test("a rerun in a round that continues a Flow keeps the step's saved address and identity beside the model's new handle", async () => {
  const at = site();
  await open(at, HELD);
  const pressed = await call(at, "rerun.1", CLICK, { selector: "#renew-saved", element: SAVED_ELEMENT, target: { handle: "t1" } });
  assert.equal(pressed.effectApplied, true, JSON.stringify(pressed.evidence).slice(0, 300));
  // The handle is the authority: the press goes to the control the page view printed.
  assert.equal(at.commands.find((command) => command.actionType === "web.dom.click")?.parameters.selector, "#renew");
});

test("a rerun of the saved list read with conditions the model rewrote still reads, because its item is the Flow's", async () => {
  const at = site();
  await open(at, HELD);
  const read = await call(at, "rerun.2", EXTRACT, { extractList: { ...SAVED_LIST, where: [{ field: "title", contains: ["renewal"] }] } });
  assert.equal(read.effectApplied, true, JSON.stringify(read.evidence).slice(0, 300));
});

test("what the model writes itself in such a round is still judged", async () => {
  const at = site();
  await open(at, HELD);
  const guessed = await call(at, "call.guess", CLICK, { selector: "#guessed", target: { handle: "t1" } });
  assert.equal(guessed.effectApplied, false);
  assert.equal(JSON.stringify(guessed.evidence).includes("web.handle.not_a_handle"), true);
  const newList = await call(at, "call.list", EXTRACT, { extractList: { item: "li.other", fields: { title: ".title" } } });
  assert.equal(newList.effectApplied, false);
  assert.equal(at.commands.some((command) => command.actionType === "web.dom.extract_list"), false);
});

test("a build that continues no Flow holds nothing, and a new build forgets what the last one held", async () => {
  const fresh = site();
  await open(fresh);
  const literal = await call(fresh, "call.one", CLICK, { selector: "#renew-saved", element: SAVED_ELEMENT, target: { handle: "t1" } });
  assert.equal(literal.effectApplied, false);
  assert.equal(JSON.stringify(literal.evidence).includes("web.handle.not_a_handle"), true);

  const again = site();
  await open(again, HELD);
  await open(again);
  const forgotten = await call(again, "call.two", CLICK, { selector: "#renew-saved", element: SAVED_ELEMENT, target: { handle: "t1" } });
  assert.equal(forgotten.effectApplied, false);
});

// t439 (`run-mv4912r9-53b05a51`): a saved step rerun as saved runs on what the
// Flow saved, whatever screen a copy of it went through, and whatever the Flow
// declared for it.

const CHECK = "web.output.dom-check";
const NAVIGATE = "web.output.browser-navigate";
/** The saved fingerprint, carrying its own selector as a saved element does. */
const SAVED_CHIP: JsonObject = { tagName: "div", visibleText: "7-in-1", classNames: ["chip"], selector: "#chips > div:nth-of-type(2)" };
/** A Flow written as a script: the press declared, the check and the navigate not (Core's script format). */
const SCRIPTED: JsonObject[] = [
  { node: NAVIGATE, parameters: { url: "https://example.test/tickets" } },
  { node: CLICK, parameters: { selector: "#renew-saved", element: SAVED_ELEMENT }, consequences: [] },
  { node: CHECK, parameters: { selector: "#chips > div:nth-of-type(2)", element: SAVED_CHIP, checked: true } }
];
/** A Flow that saved a press with no declaration, as a recorded Flow does. */
const RECORDED: JsonObject[] = [{ node: CLICK, parameters: { selector: "#renew-saved", element: SAVED_ELEMENT } }];

async function rerun(at: Site, callId: string, value: JsonObject) {
  return await at.runtime.executeTool({ ...PROJECT, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value });
}

/** The saved element as the model is shown it: the denied `selector` taken out. */
function shown(element: JsonObject): JsonObject {
  const { selector: _selector, ...rest } = element;
  return rest;
}

test("a saved step's undeclared check reruns as saved, on its saved element, with no handle and no declaration", async () => {
  const at = site();
  await open(at, SCRIPTED);
  const checked = await rerun(at, "rerun.3", { node: CHECK, parameters: { selector: "#chips > div:nth-of-type(2)", element: SAVED_CHIP, checked: true } });
  assert.equal(checked.effectApplied, true, JSON.stringify(checked.evidence).slice(0, 400));
  const command = at.commands.find((each) => each.actionType === "web.dom.check");
  assert.equal(command?.parameters.selector, "#chips > div:nth-of-type(2)");
  // The Flow keeps the saved address and fingerprint.
  assert.deepEqual((checked.draft?.ranWith as JsonObject & { parameters: JsonObject }).parameters.element, SAVED_CHIP);
});

test("a held element shown without its selector is the saved one: it runs on the saved address, not as a literal the model wrote", async () => {
  const at = site();
  await open(at, SCRIPTED);
  // What Core keeps of a step that ran as saved, merged back for a rerun: the element less its selector, no top-level selector.
  const checked = await rerun(at, "rerun.4", { node: CHECK, parameters: { element: shown(SAVED_CHIP), checked: true }, consequences: [] });
  assert.equal(checked.effectApplied, true, JSON.stringify(checked.evidence).slice(0, 400));
  assert.equal(JSON.stringify(checked.evidence).includes("not_a_handle"), false);
  const command = at.commands.find((each) => each.actionType === "web.dom.check");
  assert.equal(command?.parameters.selector, "#chips > div:nth-of-type(2)");
  assert.deepEqual((checked.draft?.ranWith as JsonObject & { parameters: JsonObject }).parameters.element, SAVED_CHIP);
});

test("an undeclared saved navigate reruns as saved", async () => {
  const at = site();
  await open(at, SCRIPTED);
  const opened = await rerun(at, "rerun.1", { node: NAVIGATE, parameters: { url: "https://example.test/tickets" } });
  assert.equal(opened.effectApplied, true, JSON.stringify(opened.evidence).slice(0, 400));
});

// Supervisor review of t439: a press must declare, saved or not. Undeclared,
// Core's permission gate would never be asked about it, so a money, delete or
// send press would pass unasked. The refusal tells the model to add it.
test("a press the Flow saved with no declaration is refused on rerun until it declares, and nothing is pressed", async () => {
  const at = site();
  await open(at, RECORDED);
  for (const parameters of [{ element: shown(SAVED_ELEMENT), selector: "#renew-saved" }, { target: { handle: "t1" } }]) {
    const refused = await rerun(at, "rerun.1", { node: CLICK, parameters });
    const evidence = refused.evidence as JsonObject & { code: string; detail: { reason: string; missing?: string[] } };
    assert.equal(evidence.code, "invalid_input");
    assert.deepEqual(evidence.detail.missing, ["consequences"]);
  }
  assert.equal(at.commands.some((each) => each.actionType === "web.dom.click"), false);
  // Declared, it runs on the saved control, put to the gate like any press.
  const declared = await rerun(at, "rerun.2", { node: CLICK, parameters: { element: shown(SAVED_ELEMENT), selector: "#renew-saved" }, consequences: [] });
  assert.equal(declared.effectApplied, true, JSON.stringify(declared.evidence).slice(0, 400));
});

test("a step that ran with a handle is kept naming its element by that handle alone, and its kept input reruns unchanged", async () => {
  const at = site();
  await open(at, SCRIPTED);
  // A rerun of the saved press with the model's handle merged over the saved address and fingerprint.
  const pressed = await rerun(at, "rerun.2", { node: CLICK, parameters: { selector: "#renew-saved", element: SAVED_ELEMENT, target: { handle: "t1" } }, consequences: [] });
  assert.equal(pressed.effectApplied, true, JSON.stringify(pressed.evidence).slice(0, 400));
  assert.deepEqual(pressed.draft?.input, { node: CLICK, parameters: { target: { handle: "t1" } }, consequences: [] });
  // The fingerprint and the address stay in what the Flow keeps.
  const kept = (pressed.draft?.ranWith as JsonObject & { parameters: JsonObject }).parameters;
  assert.equal(typeof kept.selector, "string");
  assert.equal(typeof kept.element, "object");
  const again = await rerun(at, "rerun.2.again", pressed.draft!.input as JsonObject);
  assert.equal(again.effectApplied, true, JSON.stringify(again.evidence).slice(0, 400));
});

test("a model-written element is still refused beside the saved Flow's", async () => {
  const at = site();
  await open(at, SCRIPTED);
  const guessed = await rerun(at, "call.guess", { node: CHECK, parameters: { element: { tagName: "div", visibleText: "Guessed" }, checked: true } });
  assert.equal(guessed.effectApplied, false);
  assert.equal(JSON.stringify(guessed.evidence).includes("not_a_handle"), true);
  assert.equal(at.commands.some((each) => each.actionType === "web.dom.check"), false);
});
