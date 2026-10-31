// What the plan resolution says of a control's state on each handle view (CC9,
// interface I5): `control: { stateful, state?, ensures?, idempotentWith? }`,
// read from the view the handle came from, never guessed.
//
// - A control that states its state (`aria-pressed`, a checkbox's `checked`) is
//   read from that statement: its state word, the `ensureState` signature a
//   press leaves from it, and the node that sets the state itself.
// - A plain button is no stateful control: no `control` at all.
// - A control that shows its state only in its words says nothing of itself
//   until a press of the same kind of control taught the Flow what flips; then
//   a later look at another control of that kind reads its state against it.
//
// The pages are a library catalogue's: reading lists and shelves.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "../../..";
import { shownHandle } from "../../../page-view/tests/shown-page-lines";

const SCOPE = { projectId: "project.library", flowId: "flow.library" };
const URL_ = "https://library.test/catalogue";
const CLICK = webAutomationOutputNodeId("web.dom.click");

/** A catalogue page: a reading-list toggle that states its state, a checkbox, a plain search button, and three shelf rows whose button changes its words (the third already shelved). */
function catalogue(): { runtime: WebAutomationLlmEvidenceRuntime; shelved: Set<string> } {
  const shelved = new Set<string>(["#row-3"]);
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.click") {
        const selector = String(command.parameters.selector);
        if (selector.startsWith("#row-")) shelved.add(selector);
        return { status: "succeeded" };
      }
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const row = (id: string, title: string): JsonObject[] => [
        { tagName: "h3", selector: `#row-${id}-title`, visibleText: title },
        { tagName: "button", selector: `#row-${id}`, visibleText: shelved.has(`#row-${id}`) ? "Remove from shelf" : "Save to shelf", attributes: { class: shelved.has(`#row-${id}`) ? "shelf-btn on" : "shelf-btn" } }
      ];
      const elements: JsonObject[] = [
        { tagName: "h1", selector: "#h", visibleText: "Garden catalogue" },
        { tagName: "button", selector: "#list-toggle", visibleText: "Reading list", attributes: { "aria-pressed": "false" } },
        { tagName: "button", selector: "#list-toggle-on", visibleText: "Archive view", attributes: { "aria-pressed": "true" } },
        { tagName: "input", selector: "#large-print", inputType: "checkbox", accessibleName: "Large print only", checked: true },
        { tagName: "button", selector: "#search", visibleText: "Search catalogue" },
        ...row("1", "Garden Tools Handbook"),
        ...row("2", "Pruning for Beginners"),
        ...row("3", "The Allotment Year")
      ];
      return { status: "succeeded", payload: { snapshot: { url: URL_, title: "Catalogue", interactiveElements: elements } } };
    }
  });
  return { runtime, shelved };
}

let calls = 0;
async function run(runtime: WebAutomationLlmEvidenceRuntime, node: string, parameters: JsonObject) {
  calls += 1;
  return await runtime.executeTool({ ...SCOPE, callId: `call.${calls}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node, parameters, consequences: [] } });
}

async function candidateView(runtime: WebAutomationLlmEvidenceRuntime, handle: string) {
  const answer = await runtime.resolvePlanNodeParameters({
    ...SCOPE,
    nodeDefinitionId: CLICK,
    parameters: { target: { handle } },
    declaredConsequences: [],
    permission: async () => ({ permitted: true as const }),
    handleReach: "view_history"
  });
  assert.equal(answer.status, "resolved", JSON.stringify(answer));
  return answer.status === "resolved" ? answer.handleViews?.[0] : undefined;
}

test("a control that states its state is read from the statement: state, the signature a press leaves, and the node that sets it", async () => {
  const { runtime } = catalogue();
  const looked = await run(runtime, "web.output.dom-capture_snapshot", {});
  const off = await candidateView(runtime, shownHandle(looked.evidence, "Reading list"));
  assert.deepEqual(off?.control, { stateful: true, state: "unpressed", ensures: { via: "attribute", attribute: "aria-pressed", to: true }, idempotentWith: "web.output.dom-check" });
  const on = await candidateView(runtime, shownHandle(looked.evidence, "Archive view"));
  assert.deepEqual(on?.control, { stateful: true, state: "pressed", ensures: { via: "attribute", attribute: "aria-pressed", to: false }, idempotentWith: "web.output.dom-check" });
});

test("a checkbox states its checked state, and a press leaves the other", async () => {
  const { runtime } = catalogue();
  const looked = await run(runtime, "web.output.dom-capture_snapshot", {});
  const view = await candidateView(runtime, shownHandle(looked.evidence, "Large print only"));
  assert.deepEqual(view?.control, { stateful: true, state: "checked", ensures: { via: "attribute", attribute: "checked", to: false }, idempotentWith: "web.output.dom-check" });
});

test("a plain button is no stateful control: its view carries no control at all", async () => {
  const { runtime } = catalogue();
  const looked = await run(runtime, "web.output.dom-capture_snapshot", {});
  const view = await candidateView(runtime, shownHandle(looked.evidence, "Search catalogue"));
  assert.ok(view);
  assert.equal(Object.hasOwn(view, "control"), false);
});

test("a control that shows its state in its words is unknown until a press of the same kind taught the Flow, then it is read against that", async () => {
  const { runtime } = catalogue();
  const looked = await run(runtime, "web.output.dom-capture_snapshot", {});
  const first = shownHandle(looked.evidence, "Save to shelf");
  const shelvedRow = shownHandle(looked.evidence, "Remove from shelf");
  // Nothing has been learned: the words say nothing of a state, so none is reported.
  assert.equal(Object.hasOwn((await candidateView(runtime, first)) ?? {}, "control"), false);
  assert.equal(Object.hasOwn((await candidateView(runtime, shelvedRow)) ?? {}, "control"), false);

  const pressed = await run(runtime, CLICK, { target: { handle: first } });
  assert.equal(pressed.resultCode, "web.action.succeeded", JSON.stringify(pressed.evidence));

  // The next look shows the pressed row and the third as "Remove from shelf", the second still as "Save to shelf".
  const again = await run(runtime, "web.output.dom-capture_snapshot", {});
  const rows = again.evidence;
  const [openHandle] = [shownHandle(rows, "Save to shelf")];
  const open = await candidateView(runtime, openHandle);
  const third = await candidateView(runtime, shelvedRow);
  assert.equal(open?.control?.state, "off", JSON.stringify(open));
  assert.equal(third?.control?.state, "on", JSON.stringify(third));
  assert.equal(third?.control?.stateful, true);
  assert.equal(Object.hasOwn(open?.control ?? {}, "idempotentWith"), false, "a control that states nothing has no node that sets its state");
  // The signature a press of the open row leaves is the one the first press produced.
  const ensures = open?.control?.ensures as { via?: string; gains?: string[]; loses?: string[] } | undefined;
  assert.equal(ensures?.via, "name");
  assert.ok(ensures?.gains?.includes("remove") && ensures.loses?.includes("save"), JSON.stringify(ensures));
  // And a press of the shelved row would undo it: the signature the other way round.
  const back = third?.control?.ensures as { gains?: string[]; loses?: string[] } | undefined;
  assert.ok(back?.gains?.includes("save") && back.loses?.includes("remove"), JSON.stringify(back));
  // The row the press was made on is read as the act found it (a step saves its control as it was there): off, before the press.
  assert.equal((await candidateView(runtime, first))?.control?.state, "off");
});
