// A handle on a control inside a named dialog keeps the dialog it was in (t469).
//
// Lane D round 8 (`run-mv5jnc5m-a47c3e59`): the build saved a step on the chat
// panel's "Close chat" from its handle, and the saved element carried no
// `context` at all -- the dialog is not a landmark, and the packet's context
// kept only form, landmark, list, table, shadow hosts and record. At playback,
// with the chat gone, the page scored the notifications prompt's close button
// at 0.729 and pressed it (step 0062).
//
// The extension now reports the dialog an element sits in as
// `context.dialog` (`apps/extension/src/content/identity/dialog.ts`) and
// refuses a candidate in another dialog. These rows hold the domain's half:
// - the name rides beside the selector in the binding, through the handle
//   renumbering the authoring tools apply, into the node's
//   `parameters.element.context`, and on through Core's target normalizer and
//   the gateway mapping to the command the page receives;
// - the packet the model reads does not carry it;
// - a control in no dialog saves none, and a name the secret screen withheld
//   is not saved, so it cannot refuse every replay.

import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationStudioActionConsequence } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { normalizeAutomationStudioElementTarget } from "fluxiq/automation-studio";
import { webAutomationActionFromGatewayCommand } from "../../../../client";
import { outputTargetFromPayload, webAutomationOutputNodeId } from "../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "../..";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { createWebLlmExtractionHandles } from "../../structure";
import { createWebLlmTargetPackets, resolveWebPlanNodeParameters, type WebLlmTargetPackets } from "..";

const CLICK_NODE = webAutomationOutputNodeId("web.dom.click");
const FEED_URL = "https://example.test/friends/requests/";
const NOTHING_LASTING: readonly AutomationStudioActionConsequence[] = [];
const CHAT = "Chat with Elena Sokolova";

/** The chat panel's close button, as the extension describes it from social-network-feed. */
const closeChat: JsonObject = {
  tagName: "div",
  selector: "body > div:nth-of-type(3) > div:nth-of-type(1) > div:nth-of-type(3)",
  role: "button",
  accessibleName: "Close chat",
  visibleText: "✕",
  attributes: { "aria-label": "Close chat", class: "x1pycuky xu37y6r" },
  context: { dialog: CHAT }
};
/** The notifications prompt's close button: the same control by every other signal. */
const promptClose: JsonObject = {
  tagName: "div",
  selector: "body > div:nth-of-type(4) > div > div:nth-of-type(1) > div",
  role: "button",
  accessibleName: "Close",
  visibleText: "✕",
  attributes: { "aria-label": "Close", class: "x1pycuky xu37y6r" },
  context: { dialog: "Turn on notifications?" }
};
/** A control on the page, in no dialog. */
const confirm: JsonObject = { tagName: "div", selector: "main li:nth-of-type(1) [aria-label=Confirm]", role: "button", accessibleName: "Confirm", visibleText: "Confirm" };

function runtimeOver(elements: JsonObject[]): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      return { status: "succeeded", payload: { snapshot: { url: FEED_URL, title: "Friend requests", interactiveElements: elements } } };
    }
  });
}

async function inspect(runtime: WebAutomationLlmEvidenceRuntime): Promise<void> {
  await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.inspect", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
}

async function resolvedParameters(runtime: WebAutomationLlmEvidenceRuntime, handle: string): Promise<JsonObject> {
  const resolution = await runtime.resolvePlanNodeParameters({ projectId: "project.one", flowId: "flow.one", nodeDefinitionId: CLICK_NODE, parameters: { selector: { handle } }, declaredConsequences: NOTHING_LASTING });
  assert.equal(resolution.status, "resolved", JSON.stringify(resolution));
  return resolution.status === "resolved" ? resolution.parameters : {};
}

/** The element the page is handed, through Core's target normalizer and the gateway mapping, as a Flow node's dispatch takes it. */
function dispatchedElement(parameters: JsonObject): JsonObject | undefined {
  const prepared: JsonObject = Object.assign({}, parameters);
  const target = normalizeAutomationStudioElementTarget(parameters, { source: "runtime" });
  if (target) prepared.target = target as unknown as JsonObject;
  const command = webAutomationActionFromGatewayCommand({ commandId: "command.one", actionType: "web.dom.click", parameters: prepared, target: outputTargetFromPayload(prepared) ?? {} });
  assert.equal("status" in command, false, "the command is dispatched");
  return (command as unknown as { element?: JsonObject }).element;
}

const contextOf = (element: unknown): JsonObject | undefined => (element as { context?: JsonObject } | undefined)?.context;

test("a step built from a handle inside a named dialog saves the dialog, and the page receives it", async () => {
  const runtime = runtimeOver([confirm, closeChat, promptClose]);
  await inspect(runtime);

  const saved = await resolvedParameters(runtime, "t2");
  assert.equal((saved.element as JsonObject).accessibleName, "Close chat");
  assert.deepEqual(contextOf(saved.element), { dialog: CHAT });

  const element = dispatchedElement(saved);
  assert.deepEqual(contextOf(element), { dialog: CHAT }, "the dialog survives Core's normalizer and the gateway mapping");
  assert.equal(element?.accessibleName, "Close chat");

  // The look-alike in the other dialog saves its own.
  assert.deepEqual(contextOf((await resolvedParameters(runtime, "t3")).element), { dialog: "Turn on notifications?" });
});

test("a step built from a control in no dialog saves none", async () => {
  const runtime = runtimeOver([confirm, closeChat]);
  await inspect(runtime);
  const saved = await resolvedParameters(runtime, "t1");
  assert.equal(contextOf(saved.element)?.dialog, undefined);
  assert.equal(contextOf(dispatchedElement(saved))?.dialog, undefined);
});

test("the packet the model reads does not carry the dialog; the binding keeps it beside the selector", () => {
  const binding = sanitizeWebLlmSnapshotWithBindings({ url: FEED_URL, interactiveElements: [confirm, closeChat] });
  assert.equal(JSON.stringify(binding.evidence).includes(CHAT), false);
  assert.equal(binding.dialogNames?.get("t2"), CHAT);
  assert.equal(binding.dialogNames?.has("t1"), false);
});

test("a dialog name the secret screen withheld is not saved", () => {
  const secret = { ...closeChat, context: { dialog: "Card 4111 1111 1111 1111 saved" } };
  const binding = sanitizeWebLlmSnapshotWithBindings({ url: FEED_URL, interactiveElements: [secret] });
  assert.equal(binding.dialogNames?.has("t1"), false);
});

// A candidate step stands where the steps before it left the page (`../step-views/`, `../target-packets.ts`, t748 U1
// and U1b): Core sends every candidate node the plan's steps before it (`precedingSteps`), and nothing else says where
// it stands -- not the order Core asks, which skips steps it never asks about and runs one plan straight into the next.
//
// A recipe site opens a dish as a dialog over the cook's list and pushes the
// dish's address; loading that address gives the dish's own page, another
// document, where the dish's Save sits under the same Flow handle. The packet
// store keeps one page per address, so once exploration looked at the own page,
// a Flow that opened the dialog from the list and pressed that handle named the
// own page's Save: no dialog in its identity, carried into the dialog (rerun
// round 4, photo builder, `web.target.ambiguous`). The step now follows from the
// step before it: the list card's press opened the dialog in exploration, so
// the next step's handle names the dialog's control. A Flow that loads the
// dish's own address still names the own page's control, with the words that
// page showed last, never the words an undo press there found (t743 d5 saved
// "Unlike" so).

const SCOPE = { projectId: "project.recipes", flowId: "flow.dish" };
const COOK = "https://recipes.test/cooks/ada/";
const DISH = "https://recipes.test/dish/lemon-tart/";
const DIALOG = "Lemon tart";
const DIALOG_SAVE = "body > div:nth-of-type(2) > article > section > div:nth-of-type(1)";
const PAGE_SAVE = "main > article > section > div:nth-of-type(1)";
const CLICK = webAutomationOutputNodeId("web.dom.click");
const NAVIGATE = webAutomationOutputNodeId("web.browser.navigate");
const CAPTURE = webAutomationOutputNodeId("web.dom.capture_snapshot");
const KEYPRESS = webAutomationOutputNodeId("web.dom.keypress");

/** The cook's dish cards, `t1` to `t3`; the dish's own page lists the same cards under "More from this cook". */
const CARDS: JsonObject[] = [1, 2, 3].map((card) => ({ tagName: "a", selector: `main > div > a:nth-of-type(${card})`, visibleText: `Dish ${card}`, accessibleName: `Dish ${card}` }));
/** A control of the dish, in the dialog when `dialog` is given. */
const CONTROL = (label: string, selector: string, dialog?: string): JsonObject => {
  const control: JsonObject = { tagName: "div", role: "button", selector, visibleText: label, accessibleName: label, hasClickHandler: true };
  if (dialog !== undefined) control.context = { dialog };
  return control;
};

function capture(url: string, elements: JsonObject[], timeOrigin: number) {
  return sanitizeWebLlmSnapshotWithBindings({ url, interactiveElements: elements, evidence: { navigation: { url, type: "navigate", timeOrigin } } });
}
/** The cook's list (document 1000). */
const cook = () => capture(COOK, CARDS, 1000);
/** The dish's dialog over the list at the pushed address (document 1000): Save is `t4`, Close `t5`. */
const dialog = (save: string) => capture(DISH, [...CARDS, CONTROL(save, DIALOG_SAVE, DIALOG), CONTROL("Close", "body > div:nth-of-type(2) > button", DIALOG)], 1000);
/** The dish's own page (document 2000): its Save is `t4` too, then Print. */
const ownPage = (save: string) => capture(DISH, [...CARDS, CONTROL(save, PAGE_SAVE), CONTROL("Print", "main > article > button.print")], 2000);

/**
 * Exploration as the node run records it (`../../node-run/run.ts`: the page a press left is shown, then the act is
 * kept): the card opens the dialog, Save is pressed there, the dish's own page is loaded, and Save is pressed back
 * there -- the undo, from "Saved".
 */
function explored(): WebLlmTargetPackets {
  const targets = createWebLlmTargetPackets();
  const list = cook();
  targets.remember(SCOPE, list);
  const opened = dialog("Save");
  targets.remember(SCOPE, opened);
  targets.acted(SCOPE, "t2", list, opened);
  const saved = dialog("Saved");
  targets.remember(SCOPE, saved);
  targets.acted(SCOPE, "t4", opened, saved);
  const own = ownPage("Saved");
  targets.remember(SCOPE, own);
  const undone = ownPage("Save");
  targets.remember(SCOPE, undone);
  targets.acted(SCOPE, "t4", own, undone);
  return targets;
}

type Step = { node: string; parameters: JsonObject };
const go = (url: string): Step => ({ node: NAVIGATE, parameters: { url } });
const press = (handle: string): Step => ({ node: CLICK, parameters: { target: { handle } } });
/** A handler whose page fact names `t9`: a node this domain does not run, which Core never asks about once that fact is refused. */
const HANDLER: Step = { node: "builtin.control.handler", parameters: { event: "retry", when: [{ fact: "exists", op: "exists", target: { handle: "t9" } }] } };

/** One node of a candidate's plan, as Core asks about it: with the steps before it when `before` is given, and with none otherwise. */
async function resolveStep(targets: WebLlmTargetPackets, step: Step, before: Step[] | undefined) {
  const input = {
    ...SCOPE, nodeDefinitionId: step.node, parameters: step.parameters, declaredConsequences: [] as AutomationStudioActionConsequence[],
    permission: async () => ({ permitted: true as const }), handleReach: "view_history" as const,
    precedingSteps: before?.map((earlier) => ({ definitionId: earlier.node, parameters: structuredClone(earlier.parameters) }))
  };
  return resolveWebPlanNodeParameters(input, { targets, extractions: createWebLlmExtractionHandles() });
}

/**
 * A candidate's Flow, resolved node by node in plan order as Core resolves a submission, each told the steps before it:
 * the last step's resolution. Core does not ask about the steps at `unasked` (an untouched inherited step, a refused
 * handler), though they are among the steps every later one is told of. `told: false` sends no `precedingSteps`.
 */
async function lastStep(targets: WebLlmTargetPackets, steps: Step[], options: { unasked?: number[]; told?: boolean } = {}) {
  let answer: Awaited<ReturnType<typeof resolveWebPlanNodeParameters>> | undefined;
  for (const [index, step] of steps.entries()) {
    if (options.unasked?.includes(index)) continue;
    answer = await resolveStep(targets, step, options.told === false ? undefined : steps.slice(0, index));
  }
  assert.equal(answer?.status, "resolved", JSON.stringify(answer));
  if (answer?.status !== "resolved") throw new Error("unresolved");
  return { selector: answer.parameters.selector, element: answer.parameters.element as JsonObject, views: answer.handleViews };
}

test("a Flow that opens the dish's dialog from the list and presses the handle last shown on the dish's own page names the dialog's control", async () => {
  const step = await lastStep(explored(), [go(COOK), press("t2"), press("t4")]);
  assert.equal(step.selector, DIALOG_SAVE, "the card's press opened the dialog");
  assert.deepEqual(step.element.context, { dialog: DIALOG });
  assert.equal(step.element.accessibleName, "Save", "as exploration's press in the dialog found it, not as it left it");
  assert.deepEqual(step.views, [{ handle: "t4", view: 3, location: DISH }], "shown in the dialog's newest capture, the third");
});

test("a Flow that loads the dish's own page names that page's control as it showed it last, never as an undo press there found it", async () => {
  const step = await lastStep(explored(), [go(DISH), press("t4")]);
  assert.equal(step.selector, PAGE_SAVE);
  assert.equal(step.element.context, undefined, "the own page's Save sits in no dialog");
  assert.equal(step.element.accessibleName, "Save", "the words the page showed last, not the undo's \"Saved\"");
});

test("a step that only reads stays in the dialog; one that may close it starts again, and exploration moving on changes nothing the steps say", async () => {
  const targets = explored();
  assert.equal((await lastStep(targets, [go(COOK), press("t2"), { node: CAPTURE, parameters: {} }, press("t4")])).selector, DIALOG_SAVE);
  assert.equal((await lastStep(targets, [go(COOK), press("t2"), { node: KEYPRESS, parameters: { key: "Escape" } }, press("t4")])).selector, PAGE_SAVE);
  await lastStep(targets, [go(COOK), press("t2")]);
  targets.remember(SCOPE, ownPage("Save"));
  assert.equal((await lastStep(targets, [press("t4")])).selector, PAGE_SAVE, "no step before it");
  assert.equal((await lastStep(targets, [go(COOK), press("t2"), press("t4")])).selector, DIALOG_SAVE, "the card's press still opened the dialog in exploration");
});

test("without a step before it, a handle resolves as the pages last showed it, for a candidate and for exploration alike", async () => {
  const targets = explored();
  assert.equal((await lastStep(targets, [press("t4")])).selector, PAGE_SAVE);
  assert.equal((await lastStep(targets, [go(COOK), press("t2"), press("t4")], { told: false })).selector, PAGE_SAVE, "a candidate Core told nothing: exactly as before");
  const own = targets.resolve(SCOPE, "t4", DISH);
  assert.equal(own.ok && own.selector, PAGE_SAVE);
  const onPage = targets.resolveOn(SCOPE, "t4", DISH);
  assert.equal(onPage.ok && onPage.selector, PAGE_SAVE);
});

test("a plan resolved straight after one that ended in the dialog starts from nothing: its first press names the own page's control", async () => {
  const targets = explored();
  await lastStep(targets, [go(COOK), press("t2")]);
  assert.equal((await lastStep(targets, [press("t4")])).selector, PAGE_SAVE, "no capture between the plans, and nothing before this press");
});

test("an inherited navigation Core never asks about still moves the page for the steps after it", async () => {
  const targets = explored();
  await lastStep(targets, [go(COOK), press("t2")]);
  assert.equal((await lastStep(targets, [go(DISH), press("t4")], { unasked: [0] })).selector, PAGE_SAVE, "the dish's own address was loaded");
  assert.equal((await lastStep(targets, [go(COOK), press("t2"), press("t4")], { unasked: [0] })).selector, DIALOG_SAVE, "the cook's list, then the card");
});

test("a handler Core refused before the press is still a step: what it does to the page is unknown, so the press resolves as before", async () => {
  const targets = explored();
  assert.equal((await lastStep(targets, [go(COOK), press("t2"), HANDLER, press("t4")], { unasked: [2] })).selector, PAGE_SAVE);
});
