// A detection's target, bound and named as a press's is (t903, F2).
//
// On `run-mwbkuxqt-c57f42cb` the line the task asked for sat in a closed
// account menu. A search printed its handle, a read of that handle ran, and
// three detections of it were refused `handle_not_in_packet` (0041, 0058,
// 0095): detection bound handles only through the last page view. Aimed at the
// visible account control, detection answered lists nowhere near it -- the home
// page's product grid, an item page's options -- each labelled with the
// control as its target (0054, 0087). The page below has that shape: a list of
// two cards, an account button outside it, and a menu line listed only when a
// capture asks for hidden elements.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_FIND_ON_PAGE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  WEB_LLM_STRUCTURE_RESULT_CODE,
  type WebAutomationLlmEvidenceRuntime,
  type WebLlmRepeatingStructure
} from "../..";
import { shownHandle } from "../../page-view/tests/shown-page-lines";

const SCOPE = { projectId: "project.one", flowId: "flow.one" };
const URL_ = "http://127.0.0.1:4173/scenarios/catalog/home";
const CONTAINER = "body > main > div";
const ITEM = `${CONTAINER} > div.card`;
const LINE = '[data-testid="saved-lists"]';

const STRUCTURE: JsonObject = {
  ok: true,
  proposal: {
    container: CONTAINER,
    item: ITEM,
    itemCount: 2,
    fields: [{ key: "name", label: "a.name", spec: { kind: "text", selector: ":scope > a.name", required: true }, coverage: 1 }],
    confidence: 0.8
  }
};

/** The page as a capture lists it, each element's parent by index; the menu line only when hidden elements are asked for. */
function page(includeHidden: boolean): JsonObject[] {
  const elements: JsonObject[] = [];
  const add = (element: JsonObject): number => elements.push(element) - 1;
  const header = add({ tagName: "header", selector: "body > header" });
  add({ tagName: "button", selector: "body > header > button", accessibleName: "Account", visibleText: "Account", parent: header });
  if (includeHidden) add({ tagName: "p", selector: LINE, visibleText: "Saved lists: Winter coats; Desk lamps", attributes: { "data-testid": "saved-lists" }, parent: header, hidden: true });
  const main = add({ tagName: "main", selector: "body > main" });
  const container = add({ tagName: "div", selector: CONTAINER, parent: main });
  for (const [index, name] of ["Wool coat", "Brass lamp"].entries()) {
    const card = add({ tagName: "div", selector: `${CONTAINER} > div.card:nth-of-type(${index + 1})`, attributes: { class: "card" }, parent: container });
    add({ tagName: "a", selector: `${CONTAINER} > div.card:nth-of-type(${index + 1}) > a.name`, visibleText: name, attributes: { class: "name", href: `/p/${index + 1}` }, parent: card });
  }
  return elements;
}

function runtimeOver(sent: JsonObject[]): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      sent.push(command.parameters);
      const snapshot: JsonObject = { url: URL_, title: "Catalog", interactiveElements: page(command.parameters.includeHidden === true) };
      return { status: "succeeded", payload: command.parameters.detectStructure === undefined ? { snapshot } : { snapshot, structure: structuredClone(STRUCTURE) as JsonValue } };
    }
  });
}

async function look(runtime: WebAutomationLlmEvidenceRuntime): Promise<unknown> {
  return (await runtime.executeTool({ ...SCOPE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } })).evidence;
}

let calls = 0;
async function detect(runtime: WebAutomationLlmEvidenceRuntime, target: string) {
  calls += 1;
  return runtime.executeTool({ ...SCOPE, callId: `call.detect.${calls}`, toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: { target } });
}

test("a handle only a search printed binds a detection, as it binds a press or a read", async () => {
  const sent: JsonObject[] = [];
  const runtime = runtimeOver(sent);
  await look(runtime);
  const found = await runtime.executeTool({ ...SCOPE, callId: "call.find", toolId: WEB_LLM_FIND_ON_PAGE_TOOL_ID, value: { query: "saved lists" } });
  const line = /^(t\d+) p "Saved lists/mu.exec(String((found.evidence as JsonObject).found))?.[1];
  assert.ok(line !== undefined, String((found.evidence as JsonObject).found));

  sent.length = 0;
  const detected = await detect(runtime, line);
  assert.equal(detected.resultCode, WEB_LLM_STRUCTURE_RESULT_CODE, JSON.stringify(detected.evidence));
  // The detection is aimed at the line's own selector, as a read of it is.
  assert.deepEqual(sent.at(-1)?.detectStructure, { selector: LINE });
});

test("a list the capture shows away from the target names no target; one around it names it", async () => {
  const runtime = runtimeOver([]);
  const shown = await look(runtime);

  const away = await detect(runtime, shownHandle(shown, "Account"));
  assert.equal(away.resultCode, WEB_LLM_STRUCTURE_RESULT_CODE);
  assert.equal((away.evidence as WebLlmRepeatingStructure).target, undefined, "the cards are not around the account button, and the packet does not say they are");

  const card = shownHandle(shown, "Brass lamp");
  const around = await detect(runtime, card);
  assert.equal((around.evidence as WebLlmRepeatingStructure).target, card);
});
