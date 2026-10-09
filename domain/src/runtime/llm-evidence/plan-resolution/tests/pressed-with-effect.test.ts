// A control the capture cannot see as one, which exploration pressed and saw
// work, is one a candidate may press (t378, W13).
//
// W6 refused a candidate's press on an element the page view prints as plain
// text (`web.handle.not_a_control`, lane D's chat message `t860`). A page can
// also make words a control with a listener the capture cannot see -- one a
// framework adds at the document -- and such words print as text. Exploration
// may press anything a person could, so it presses them, and the page answers;
// the candidate then wrote the same press and was refused for a step that was
// right. Held here: a press exploration ran that changed the page makes its
// handle pressable for the Flow (`../../node-run/run.ts`, `../target-packets.ts`);
// a press that changed nothing proves nothing, and lane D's message stays refused.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "../..";
import { shownHandle } from "../../page-view/tests/shown-page-lines";

const SCOPE = { projectId: "project.pressed", flowId: "flow.pressed" };
const URL_ = "https://photo-social.test/posts/42";
const CLICK = webAutomationOutputNodeId("web.dom.click");
const MORE = "#thread > p.more";
const MESSAGE = "#thread > p.message";

/** A thread whose "View 3 more replies" line opens the replies on a press the capture cannot see. */
function thread(): { runtime: WebAutomationLlmEvidenceRuntime; clicks: string[] } {
  let open = false;
  const clicks: string[] = [];
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.click") {
        clicks.push(String(command.parameters.selector));
        if (command.parameters.selector === MORE) open = true;
        return { status: "succeeded" };
      }
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const elements: JsonObject[] = [
        { tagName: "h2", selector: "#thread > h2", visibleText: "Comments" },
        { tagName: "p", selector: MESSAGE, visibleText: "Lovely light in this one" },
        { tagName: "p", selector: MORE, visibleText: "View 3 more replies" }
      ];
      if (open) elements.push({ tagName: "p", selector: "#thread > p.reply", visibleText: "Agreed, the dusk colours are great" });
      return { status: "succeeded", payload: { snapshot: { url: URL_, title: "Post", interactiveElements: elements } } };
    }
  });
  return { runtime, clicks };
}

let calls = 0;
async function run(runtime: WebAutomationLlmEvidenceRuntime, node: string, parameters: JsonObject) {
  calls += 1;
  return await runtime.executeTool({ ...SCOPE, callId: `call.${calls}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node, parameters, consequences: [] } });
}

function candidatePress(runtime: WebAutomationLlmEvidenceRuntime, handle: string) {
  return runtime.resolvePlanNodeParameters({
    ...SCOPE,
    nodeDefinitionId: CLICK,
    parameters: { target: { handle } },
    declaredConsequences: [],
    permission: async () => ({ permitted: true as const }),
    handleReach: "view_history"
  });
}

test("words exploration pressed and saw change the page are a control a candidate may press", async () => {
  const { runtime, clicks } = thread();
  const looked = await run(runtime, "web.output.dom-capture_snapshot", {});
  const more = shownHandle(looked.evidence, "View 3 more replies");

  // Before any press it reads as plain text, and a candidate is refused it.
  const before = await candidatePress(runtime, more);
  assert.equal(before.status, "refused", JSON.stringify(before));
  if (before.status === "refused") assert.equal(before.issueCodes[0], "web.handle.not_a_control");

  const pressed = await run(runtime, CLICK, { target: { handle: more } });
  assert.equal(pressed.resultCode, "web.action.succeeded", JSON.stringify(pressed.evidence));
  assert.equal((pressed.evidence as { pageChanged?: boolean }).pageChanged, true, JSON.stringify(pressed.evidence));
  assert.deepEqual(clicks, [MORE]);

  const after = await candidatePress(runtime, more);
  assert.equal(after.status, "resolved", JSON.stringify(after));
  if (after.status === "resolved") assert.equal(after.parameters.selector, MORE);
});

test("words exploration pressed with no effect stay plain text to a candidate, as lane D's message did", async () => {
  const { runtime, clicks } = thread();
  const looked = await run(runtime, "web.output.dom-capture_snapshot", {});
  const message = shownHandle(looked.evidence, "Lovely light in this one");

  const pressed = await run(runtime, CLICK, { target: { handle: message } });
  assert.equal(pressed.resultCode, "web.action.succeeded", JSON.stringify(pressed.evidence));
  assert.equal((pressed.evidence as { pageChanged?: boolean }).pageChanged, false, JSON.stringify(pressed.evidence));
  assert.deepEqual(clicks, [MESSAGE]);

  const answer = await candidatePress(runtime, message);
  assert.equal(answer.status, "refused", JSON.stringify(answer));
  if (answer.status === "refused") assert.equal(answer.issueCodes[0], "web.handle.not_a_control");
});
