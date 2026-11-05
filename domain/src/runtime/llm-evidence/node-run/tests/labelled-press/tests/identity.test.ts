// What a press by a handle says it would run with, against what it ran with, for a control named by the
// label beside it (`../../../observed-control.ts`, `webLabelledIdentity`; t870). Core's act record reads both
// (`answer-first/act-record/tests/identical-rows.test.ts` feeds it these very shapes). A lending library.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../../..";
import { shownPageLines } from "../../../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.library", flowId: "flow.library" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const PAGE = "https://library.test/account";
const SWITCH = "form > div:nth-of-type(2) > div";
const LABEL = "Keep me posted";

const namedByNothing: JsonObject = { tagName: "div", role: "button", selector: SWITCH };
const namedByItsLabel: JsonObject = { tagName: "div", role: "button", selector: SWITCH, label: LABEL };

/** An identity with its label left out, to compare the rest of two. */
function withoutLabel(element: JsonObject): JsonObject {
  const { label: _label, ...rest } = element;
  return rest;
}

/** A page whose one nameless control has the label beside it on the looks `labelOn` says. */
function page(labelOn: (look: number) => boolean) {
  const sent: JsonObject[] = [];
  let looks = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.click") {
        sent.push(command.parameters as JsonObject);
        return { status: "succeeded", payload: { value: "ok" } };
      }
      looks += 1;
      const control = labelOn(looks) ? namedByItsLabel : namedByNothing;
      const status: JsonObject[] = sent.length ? [{ tagName: "span", selector: "main .status", visibleText: `${sent.length} changed` }] : [];
      return { status: "succeeded", payload: { snapshot: { url: PAGE, title: "Account", viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 }, interactiveElements: [control, { tagName: "button", selector: "#other", visibleText: "Other" }, ...status] } } };
    }
  };
  return { gateway, sent };
}

async function pressedOnce(labelOn: (look: number) => boolean) {
  const stub = page(labelOn);
  const runtime = createWebAutomationLlmEvidenceRuntime(stub.gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const handle = shownPageLines(looked.evidence).find((line) => line.words !== "Other")!.target;
  const call = { node: CLICK, parameters: { target: { handle } }, consequences: [] };
  const described = runtime.describeCall({ ...PROJECT, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: call });
  const pressed = await runtime.executeTool({ ...PROJECT, callId: "press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: call });
  assert.equal(pressed.resultCode, "web.action.succeeded", JSON.stringify(pressed.evidence).slice(0, 300));
  return { foreseen: described?.wouldRunWith as JsonObject, ran: pressed.draft?.ranWith?.parameters as JsonObject, sent: stub.sent };
}

test("a control whose look held its label says exactly what it runs with", async () => {
  const { foreseen, ran } = await pressedOnce(() => true);
  assert.equal((ran.element as JsonObject).label, LABEL);
  assert.deepEqual(foreseen, ran);
});

test("a control only the look before the press names keeps a thinner identity than it runs with, at the same address and with its own label only", async () => {
  const { foreseen, ran, sent } = await pressedOnce((look) => look > 1);
  assert.equal(foreseen.selector, SWITCH);
  assert.equal(ran.selector, SWITCH);
  assert.equal("label" in (foreseen.element as JsonObject), false);
  assert.equal((ran.element as JsonObject).label, LABEL);
  assert.deepEqual(withoutLabel(ran.element as JsonObject), withoutLabel(foreseen.element as JsonObject));
  // What goes to the page is what it always was: the label is on what is sent.
  assert.equal((sent[0]!.element as JsonObject).label, LABEL);
});
