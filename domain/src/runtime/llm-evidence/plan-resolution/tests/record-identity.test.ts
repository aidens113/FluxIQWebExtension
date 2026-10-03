// A handle on a control the page repeats in every card carries the card.
//
// Live run `run-munri5gr-94d7f8a0` (bigbox-retail): the store chooser inside
// `vr-fulfillment-picker`'s open root lists four stores, and every card but the
// chosen one holds an identical "Set as my store" button
// (`apps/scenario-lab/src/scenarios/bigbox-retail/shell/store-picker.ts`). The
// model pressed Millbrook's, and the draft kept the step as
// `div > ul > li:nth-of-type(3) > button` plus an identity of tag, name and host
// chain -- nothing that said *which* card. When the dry run met the chooser with
// Millbrook already chosen, the third card held "Your store" and no button, and
// the step read the three other stores' buttons as one ambiguous target
// (`core.replay.failed`); on a page whose cards had moved it would have pressed
// whichever store sat third.
//
// What these rows hold:
// - the handle's identity carries `context.record` with the card's own words,
//   from the packet's `within`, and on through Core's target normalizer and the
//   gateway mapping to the command the page receives;
// - a control in no record (the chooser's chip) carries none;
// - words the packet had to cut are not carried, because the page compares a
//   record's words whole.
//
// That the page then presses only in that card, and reads a missing card as
// missing, is the extension's to prove
// (`apps/extension/src/content/action-runtime/tests/store-chooser-replay.test.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationStudioActionConsequence } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { normalizeAutomationStudioElementTarget } from "fluxiq/automation-studio";
import { webAutomationActionFromGatewayCommand } from "../../../../client";
import { outputTargetFromPayload, webAutomationOutputNodeId } from "../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, WEB_LLM_WITHHELD_TEXT, type WebAutomationLlmEvidenceRuntime } from "../..";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";

const CLICK_NODE = webAutomationOutputNodeId("web.dom.click");
const HOME_URL = "http://127.0.0.1:4100/bigbox/";
const HOSTS = ["header > div > vr-fulfillment-picker"];
const NOTHING_LASTING: readonly AutomationStudioActionConsequence[] = [];

/** A card's own words, as `identity/record.ts` reads them: its text less its button's, with no separator between blocks. */
const CARD_WORDS = {
  cardenNeighborhood: "Carden Falls Neighborhood Market212 W Mill St, Carden Falls · 3.4 miOpen until 10pm",
  millbrookSupercenter: "Millbrook Crossing Supercenter88 Ferris Rd, Millbrook · 9.8 miOpen 24 hours",
  millbrookNeighborhood: "Millbrook Crossing Neighborhood Market17 Canal St, Millbrook · 10.6 miOpen until 10pm"
};

/** The chip: the stable label and the chosen store's name, one button, in no record. */
const chip: JsonObject = {
  tagName: "button",
  selector: "button",
  visibleText: "Pickup or delivery?Carden Falls Supercenter",
  accessibleName: "Pickup or delivery?Carden Falls Supercenter",
  implicitRole: "button",
  context: { shadowHosts: HOSTS }
};

/** One card's "Set as my store", as `describe-element.ts` describes it with the flyout open and Carden Falls Supercenter chosen. */
function setStore(position: number, words: string): JsonObject {
  return {
    tagName: "button",
    selector: `div > ul > li:nth-of-type(${position}) > button`,
    visibleText: "Set as my store",
    accessibleName: "Set as my store",
    implicitRole: "button",
    context: { shadowHosts: HOSTS, listPosition: { index: position - 1, total: 4 }, record: { text: words } }
  };
}

const CHOOSER_OPEN: JsonObject[] = [
  chip,
  setStore(2, CARD_WORDS.cardenNeighborhood),
  setStore(3, CARD_WORDS.millbrookSupercenter),
  setStore(4, CARD_WORDS.millbrookNeighborhood)
];

function runtimeOver(elements: JsonObject[]): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      return { status: "succeeded", payload: { snapshot: { url: HOME_URL, title: "Bigbox", interactiveElements: elements } } };
    }
  });
}

async function inspect(runtime: WebAutomationLlmEvidenceRuntime): Promise<void> {
  await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.inspect", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
}

async function clickParameters(runtime: WebAutomationLlmEvidenceRuntime, handle: string): Promise<JsonObject> {
  const resolution = await runtime.resolvePlanNodeParameters({ projectId: "project.one", flowId: "flow.one", nodeDefinitionId: CLICK_NODE, parameters: { selector: { handle } }, declaredConsequences: NOTHING_LASTING });
  assert.equal(resolution.status, "resolved", JSON.stringify(resolution));
  return resolution.status === "resolved" ? resolution.parameters : {};
}

/** The element the page is handed, through Core's target normalizer and the gateway mapping. */
function dispatchedElement(parameters: JsonObject): JsonObject | undefined {
  const prepared: JsonObject = Object.assign({}, parameters);
  const target = normalizeAutomationStudioElementTarget(parameters, { source: "runtime" });
  if (target) prepared.target = target as unknown as JsonObject;
  const command = webAutomationActionFromGatewayCommand({ commandId: "command.one", actionType: "web.dom.click", parameters: prepared, target: outputTargetFromPayload(prepared) ?? {} });
  assert.equal("status" in command, false, "the command is dispatched");
  return (command as unknown as { element?: JsonObject }).element;
}

/** The handle the packet gave the button whose card has these words. */
function handleWithin(elements: JsonObject[], words: string): string {
  const binding = sanitizeWebLlmSnapshotWithBindings({ url: HOME_URL, interactiveElements: elements });
  const found = binding.evidence.elements.find((element) => element.within === words);
  assert.ok(found, `the packet names the card "${words}" on one of its buttons`);
  return found.target;
}

test("Millbrook's Set as my store carries Millbrook's card to the page", async () => {
  const runtime = runtimeOver(CHOOSER_OPEN);
  await inspect(runtime);
  const handle = handleWithin(CHOOSER_OPEN, CARD_WORDS.millbrookSupercenter);

  const clicked = await clickParameters(runtime, handle);
  const context = (clicked.element as JsonObject | undefined)?.context as JsonObject | undefined;
  assert.deepEqual(context?.record, { text: CARD_WORDS.millbrookSupercenter }, "the identity names the card, not only the position");
  assert.deepEqual(context?.shadowHosts, HOSTS, "and still the root it is in");

  const element = dispatchedElement(clicked);
  assert.deepEqual((element?.context as JsonObject | undefined)?.record, { text: CARD_WORDS.millbrookSupercenter }, "the record survives Core's normalizer and the gateway mapping");
});

// Live run `run-murwcaj0-40e56557` (J1): a press repeated over a listing is given each kept row, which replaces the
// card it was built on, so Core leaves that card out of what it tells the judge the step acts on. Core names no web
// key (AGENTS.md), so the runtime declares which key holds the card, as it declares `deniedEvidenceKeys`.
test("the runtime declares to Core the key a handle's card travels under, and it is the key the identity writes", async () => {
  const runtime = runtimeOver(CHOOSER_OPEN);
  assert.deepEqual(runtime.rowContextKeys, ["record"]);
  await inspect(runtime);
  const clicked = await clickParameters(runtime, handleWithin(CHOOSER_OPEN, CARD_WORDS.millbrookSupercenter));
  const context = (clicked.element as JsonObject | undefined)?.context as JsonObject | undefined;
  const carried = Object.keys(context ?? {}).filter((key) => runtime.rowContextKeys.includes(key));
  assert.deepEqual(carried, ["record"], "the declared key is the one the card travels under, and nothing else in the context is");
});

test("the chooser's chip sits in no card and carries no record", async () => {
  const runtime = runtimeOver(CHOOSER_OPEN);
  await inspect(runtime);
  const binding = sanitizeWebLlmSnapshotWithBindings({ url: HOME_URL, interactiveElements: CHOOSER_OPEN });
  const chipHandle = binding.evidence.elements.find((element) => element.name?.startsWith("Pickup or delivery?"))?.target;
  assert.ok(chipHandle);
  const clicked = await clickParameters(runtime, chipHandle);
  assert.equal(((clicked.element as JsonObject).context as JsonObject).record, undefined);
});

test("long card words arrive whole, and are carried as the card", async () => {
  const long = `${"Millbrook Crossing Supercenter ".repeat(4)}88 Ferris Rd`;
  const elements = [chip, setStore(2, CARD_WORDS.cardenNeighborhood), setStore(3, long)];
  const runtime = runtimeOver(elements);
  await inspect(runtime);
  const handle = handleWithin(elements, long);
  const clicked = await clickParameters(runtime, handle);
  assert.deepEqual(((clicked.element as JsonObject).context as JsonObject).record, { text: long });
});

test("card words the packet withheld as a secret are not carried as the card", async () => {
  const secret = "Millbrook Crossing sk-live0123456789abcdefghijKLMN";
  const elements = [chip, setStore(2, CARD_WORDS.cardenNeighborhood), setStore(3, secret)];
  const runtime = runtimeOver(elements);
  await inspect(runtime);
  const handle = handleWithin(elements, WEB_LLM_WITHHELD_TEXT);
  const clicked = await clickParameters(runtime, handle);
  assert.equal(((clicked.element as JsonObject).context as JsonObject).record, undefined);
});
