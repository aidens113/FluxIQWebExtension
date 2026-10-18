// A press through a layer, and a handle a layer took away (t223; C1, C3, C4
// and C9 of `run-mup2i28c-6c7fc209`). The store page of that run, small: a
// store button, then a timed popup that opens over it.
//
// Since `run-mvcxf4uz-64cd322c` (lane 2 fix 4) a press under a cover the
// runtime's own defence clears -- a "No thanks", a close glyph -- is sent, and
// the extension closes the cover and presses (`../layer/runtime-clears.ts`).
// The fake page answers such a press as the extension does: the cover is gone,
// the control was pressed, and the result names the layer it closed. A cover
// with no such closer, or one only a person answers, is still refused (C4).

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";
import { shownHandle, shownPageLines } from "../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.covered", flowId: "flow.covered" } as const;
const URL = "https://shop.example/store";
const LOOK = "web.output.dom-capture_snapshot";
const CLICK = "web.output.dom-click";

/**
 * `banner`: a layer beside the main column that covers nothing, as a cookie banner at the foot of the page.
 * `check`: a robot check over the page; `signin`: a modal asking for a password. Both are a person's.
 */
type Layer = "none" | "popup" | "dialog" | "banner" | "overlap" | "check" | "signin";

/** The words of the one control on the layer: a dismissal the runtime presses, or one it never does. */
const DEFAULT_CLOSER = "No thanks";

const POPUP_NAME = "Get $10 off your first pickup order";

/** What the extension's result says it closed, as `client/gateway-mapping.ts` copies it, way out included. */
function clearedPopup(closer: string): JsonObject[] {
  return [{
    kind: "promotion", control: "No thanks", name: POPUP_NAME, controlName: closer,
    wayOut: { url: URL, element: { tagName: "button", selector: "body > div:nth-of-type(1) > button", xpath: "/html/body/div[1]/button", visibleText: closer } }
  }];
}

/**
 * The store page with the main column under `body`, and the layer the test
 * opens beside it. A press on the page's own controls changes its status line,
 * as a real page answers a press, so no press here is taken for one that
 * changed nothing (t511) and pressed once more.
 */
function store(): { gateway: WebLlmEvidenceGateway; clicks: string[]; open(layer: Layer, closer?: string): void } {
  let layer: Layer = "none";
  let closer = DEFAULT_CLOSER;
  let status = "Choose pickup or delivery";
  const clicks: string[] = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.click") {
        clicks.push(String(command.parameters.selector));
        const selector = String(command.parameters.selector);
        if (selector === "body > div:nth-of-type(1) > button") layer = "none";
        // The extension's defence: a press under the popup is refused at the
        // click's gate, the popup's way out is pressed, and the press is made.
        const cleared = layer === "popup" && selector.startsWith("body > div:nth-of-type(2) >") ? clearedPopup(closer) : undefined;
        if (cleared) layer = "none";
        if (selector.endsWith("> header > button")) status = "Pickup chosen";
        if (selector.endsWith("> main > a")) status = "Wireless earbuds opened";
        return cleared
          ? { status: "succeeded", payload: { commandId: "cmd.click", actionType: "web.dom.click", status: "succeeded", message: "Element clicked.", clearedLayers: cleared } }
          : { status: "succeeded" };
      }
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      return { status: "succeeded", payload: { snapshot: snapshot(layer, status, closer) } };
    }
  };
  const open = (next: Layer, words = DEFAULT_CLOSER): void => {
    layer = next;
    closer = words;
  };
  return { gateway, clicks, open };
}

function snapshot(layer: Layer, status: string, closer: string): JsonObject {
  const main = layer === "none" ? "body > div" : "body > div:nth-of-type(2)";
  const storeButton = `${main} > header > button`;
  const elements: JsonObject[] = [
    { tagName: "button", selector: storeButton, visibleText: "Pickup or delivery?" },
    { tagName: "a", selector: `${main} > main > a`, visibleText: "Wireless earbuds", attributes: { href: "/p/1" } },
    { tagName: "p", selector: `${main} > main > p`, visibleText: status }
  ];
  if (layer === "none") return { url: URL, title: "Store", interactiveElements: elements };
  const cover = "body > div:nth-of-type(1)";
  const modal = layer === "dialog" || layer === "signin";
  const label = layer === "dialog" ? "Choose a store" : layer === "signin" ? "Sign in to continue" : layer === "check" ? "Checking your connection" : POPUP_NAME;
  const layerElement: JsonObject = modal ? { tagName: "div", selector: cover, role: "dialog", accessibleName: label } : { tagName: "div", selector: cover, accessibleName: label };
  // The button's `parent` is the layer's index among the captured elements, as the capture writes it.
  const popup: JsonObject[] = [layerElement, { tagName: "button", selector: `${cover} > button`, visibleText: closer, parent: 0 }];
  // A secret field is never described (`../../elements.ts`): the sign-in is known by its words.
  if (layer === "signin") popup.push({ tagName: "input", selector: `${cover} > input`, inputType: "password", accessibleName: "Password", parent: 0 });
  const blocker: JsonObject = { selector: cover, label, blocks: 2, blocked: [storeButton, `${main} > main > a`] };
  // An overlap is a blocker the capture recognised no kind for.
  if (layer !== "overlap") blocker.kind = layer === "dialog" ? "consent" : layer === "check" ? "robot_check" : "promotion";
  const evidence: JsonObject = layer === "banner" ? {} : { overlays: { tested: 3, blockedCount: 2, blockers: [blocker] } };
  if (modal) evidence.dialogs = { open: [{ selector: cover, role: "dialog", label, modal: true }] };
  return {
    url: URL,
    title: "Store",
    interactiveElements: [...popup, ...elements],
    evidence
  };
}

let calls = 0;
async function call(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>, node: string, parameters: JsonObject) {
  calls += 1;
  return await runtime.executeTool({ ...PROJECT, callId: `call.${calls}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node, parameters, consequences: [] } });
}

test("a timed popup with no way out the runtime presses opens over the control: the press is refused before it is sent, naming the cover, with the page, and the handle stays the same (C4)", async () => {
  const page = store();
  const runtime = createWebAutomationLlmEvidenceRuntime(page.gateway);
  const looked = await call(runtime, LOOK, {});
  const storeButton = shownHandle(looked.evidence, "Pickup or delivery?");

  // The popup opens on a timer, after the look the model read (C9). Its one
  // control confirms rather than dismisses, so the runtime would not press it.
  page.open("popup", "Apply");
  const refused = await call(runtime, CLICK, { target: { handle: storeButton } });
  assert.equal(refused.resultCode, "web.action.rejected.target_covered");
  assert.equal(refused.effectApplied, false);
  assert.deepEqual(page.clicks, [], "nothing was sent through the popup (C4)");
  const evidence = refused.evidence as { detail: { reason: string; target: string; instead: string[]; closeWith?: string[]; next?: string }; page: { schemaVersion: string; page: string } };
  assert.equal(evidence.detail.reason, "covered_by_layer");
  // What covers it, and how to clear it: the popup's own "Apply", by handle, and to make the call again (crossborder run-muqc07fh-eeffbc86, 0018).
  assert.deepEqual(evidence.detail.closeWith, [shownHandle(evidence, "Apply")]);
  // The closer and the order inline, and never "the same call again, unchanged" (run-mvcwem7d-34689f55).
  const closer = shownHandle(evidence, "Apply");
  assert.equal(evidence.detail.next, `Nothing was done: layer ${evidence.detail.instead[0]} covers ${storeButton}. Press ${closer} first; it closes that layer. `
    + `Do not press ${storeButton} again while ${evidence.detail.instead[0]} covers it: that press is refused the same way. Once the layer is gone, press ${storeButton} again.`);
  assert.equal(evidence.detail.target, storeButton, "the control kept its handle behind the popup (C1)");
  // The page comes back with the popup in it, and names it (C3, C9).
  assert.equal(evidence.page.schemaVersion, "web-llm-page.v3");
  const cover = evidence.detail.instead[0]!;
  assert.match(evidence.page.page, new RegExp(`^COVERING ${cover} "Get \\$10 off your first pickup order"`, "mu"));
  assert.match(evidence.page.page, new RegExp(`^${storeButton} button "Pickup or delivery\\?" covered-by ${cover}$`, "mu"));

  // The popup's own control, from the page the refusal handed back, is pressed next.
  const dismissed = await call(runtime, CLICK, { target: { handle: shownHandle(evidence, "Apply") } });
  assert.equal(dismissed.resultCode, "web.action.succeeded", JSON.stringify(dismissed.evidence));
  // And the store button, by the handle the model was shown before the popup.
  const pressed = await call(runtime, CLICK, { target: { handle: storeButton } });
  assert.equal(pressed.resultCode, "web.action.succeeded", JSON.stringify(pressed.evidence));
  assert.deepEqual(page.clicks, ["body > div:nth-of-type(1) > button", "body > div > header > button"]);
});

test("a layer that opens beside the page and covers nothing leaves the handle the model was shown pressable (C2)", async () => {
  const page = store();
  const runtime = createWebAutomationLlmEvidenceRuntime(page.gateway);
  const storeButton = shownHandle((await call(runtime, LOOK, {})).evidence, "Pickup or delivery?");
  // The look the press takes first describes the whole page, and is remembered
  // in its place; the handle the model was shown is still in it.
  page.open("banner");
  const pressed = await call(runtime, CLICK, { target: { handle: storeButton } });
  assert.equal(pressed.resultCode, "web.action.succeeded", JSON.stringify(pressed.evidence));
  assert.deepEqual(page.clicks, ["body > div:nth-of-type(2) > header > button"]);
});

test("a modal dialog over the control whose only control confirms refuses the press as blocked_by_dialog, naming the dialog", async () => {
  const page = store();
  const runtime = createWebAutomationLlmEvidenceRuntime(page.gateway);
  const storeButton = shownHandle((await call(runtime, LOOK, {})).evidence, "Pickup or delivery?");
  page.open("dialog", "Done");
  const refused = await call(runtime, CLICK, { target: { handle: storeButton } });
  assert.equal(refused.resultCode, "web.action.rejected.blocked_by_dialog");
  const evidence = refused.evidence as { detail: { reason: string; instead: string[] }; page: { page: string } };
  assert.equal(evidence.detail.reason, "covered_by_layer");
  assert.match(evidence.page.page, new RegExp(`^DIALOG ${evidence.detail.instead[0]} "Choose a store" modal`, "mu"));
  assert.deepEqual(page.clicks, []);
});

test("a read is not refused for a layer, since reading under it changes nothing", async () => {
  const page = store();
  const runtime = createWebAutomationLlmEvidenceRuntime(page.gateway);
  await call(runtime, LOOK, {});
  page.open("popup");
  const looked = await call(runtime, LOOK, {});
  assert.equal(looked.resultCode, "web.inspect.succeeded");
  assert.ok(shownPageLines(looked.evidence).some((line) => line.words === "No thanks"));
});

test("a handle the page no longer has is refused with the page as it now stands, whose handles can be used next", async () => {
  const page = store();
  const runtime = createWebAutomationLlmEvidenceRuntime(page.gateway);
  await call(runtime, LOOK, {});
  const refused = await call(runtime, CLICK, { target: { handle: "t99" } });
  assert.equal(refused.resultCode, "web.action.rejected.target_unobserved");
  const evidence = refused.evidence as { detail: { reason: string }; page?: { schemaVersion: string; location: string } };
  assert.equal(evidence.detail.reason, "handle_not_in_packet");
  assert.equal(evidence.page?.schemaVersion, "web-llm-page.v3");
  assert.equal(evidence.page?.location, URL);
  const pressed = await call(runtime, CLICK, { target: { handle: shownHandle(evidence, "Wireless earbuds") } });
  assert.equal(pressed.resultCode, "web.action.succeeded");
});

test("an element that merely overlaps the control, no dialog and no recognised layer, does not refuse the press", async () => {
  // Live: a price's aria-hidden twin, a floating field label and a card's stretched
  // link each mark what they overlap `coveredBy`; refusing them refused presses that work.
  const page = store();
  const runtime = createWebAutomationLlmEvidenceRuntime(page.gateway);
  const storeButton = shownHandle((await call(runtime, LOOK, {})).evidence, "Pickup or delivery?");
  page.open("overlap");
  const pressed = await call(runtime, CLICK, { target: { handle: storeButton } });
  assert.equal(pressed.resultCode, "web.action.succeeded", JSON.stringify(pressed.evidence));
  assert.deepEqual(page.clicks, ["body > div:nth-of-type(2) > header > button"]);
});

test("the same covered press made again, unchanged, is answered as a repeat that still names the layer's closers (run-mvcwem7d-34689f55)", async () => {
  const page = store();
  const runtime = createWebAutomationLlmEvidenceRuntime(page.gateway);
  const storeButton = shownHandle((await call(runtime, LOOK, {})).evidence, "Pickup or delivery?");
  page.open("popup", "Apply");
  const first = await call(runtime, CLICK, { target: { handle: storeButton } });
  const again = await call(runtime, CLICK, { target: { handle: storeButton } });
  assert.equal(again.resultReason, "answered_the_same_again");
  assert.equal(again.repeatedAnswer, 2);
  type Said = { detail: { reason: string; instead: string[]; closeWith?: string[]; next?: string; repeatedAnswer?: number } };
  const before = (first.evidence as Said).detail;
  const repeated = (again.evidence as Said).detail;
  assert.equal(repeated.reason, "covered_by_layer");
  assert.equal(repeated.repeatedAnswer, 2);
  // The closers were dropped from exactly this answer, and the next with them.
  assert.deepEqual(repeated.closeWith, before.closeWith);
  assert.ok(repeated.closeWith?.length === 1);
  assert.equal(repeated.next, before.next);
  assert.ok(repeated.next?.includes(`Press ${repeated.closeWith[0]} first; it closes that layer.`), repeated.next);
  assert.deepEqual(page.clicks, [], "neither press was sent through the popup");
});

test("a press under a popup the runtime clears is sent, and its answer names the layer the runtime closed and the page without it (run-mvcxf4uz-64cd322c)", async () => {
  const page = store();
  const runtime = createWebAutomationLlmEvidenceRuntime(page.gateway);
  const storeButton = shownHandle((await call(runtime, LOOK, {})).evidence, "Pickup or delivery?");
  // The popup's "No thanks" is on the extension's dismissal allow-list.
  page.open("popup");
  const pressed = await call(runtime, CLICK, { target: { handle: storeButton } });
  assert.equal(pressed.resultCode, "web.action.succeeded", JSON.stringify(pressed.evidence));
  assert.equal(pressed.effectApplied, true);
  assert.deepEqual(page.clicks, ["body > div:nth-of-type(2) > header > button"], "the press itself was sent once, never the popup's control");
  // The page and what the node did, side by side (`../run.ts`, `nodeEvidence`).
  const evidence = pressed.evidence as { status: string; read?: { clearedLayers?: JsonObject[] }; page: string };
  // What the runtime closed reaches the model on the press's own read: kind, word and the two names.
  const cleared = evidence.read?.clearedLayers;
  assert.ok(Array.isArray(cleared) && cleared.length === 1, JSON.stringify(evidence.read));
  assert.equal(cleared[0]!.kind, "promotion");
  assert.equal(cleared[0]!.control, "No thanks");
  assert.equal(cleared[0]!.name, POPUP_NAME);
  assert.equal(cleared[0]!.controlName, "No thanks");
  // Never its way out: the page's address and the control's xpath stop at the
  // domain's server half (`../page-record.ts`, `actions/cleared-layers.ts`).
  assert.equal(cleared[0]!.wayOut, undefined, JSON.stringify(cleared[0]));
  assert.doesNotMatch(JSON.stringify(evidence.read), /\/html\/body/u);
  // And the page after it has no popup in it, and the press's own answer.
  assert.doesNotMatch(evidence.page, /^COVERING /mu);
  assert.match(evidence.page, /Pickup chosen/u);
});

test("a press under a robot check is refused, whatever close glyph the check carries: it is a person's", async () => {
  const page = store();
  const runtime = createWebAutomationLlmEvidenceRuntime(page.gateway);
  const storeButton = shownHandle((await call(runtime, LOOK, {})).evidence, "Pickup or delivery?");
  page.open("check", "×");
  const refused = await call(runtime, CLICK, { target: { handle: storeButton } });
  assert.equal(refused.resultCode, "web.action.rejected.target_covered", JSON.stringify(refused.evidence));
  assert.equal((refused.evidence as { detail: { reason: string } }).detail.reason, "covered_by_layer");
  assert.deepEqual(page.clicks, []);
});

test("a press under a sign-in dialog is refused, though its Not now would close it: it is a person's", async () => {
  const page = store();
  const runtime = createWebAutomationLlmEvidenceRuntime(page.gateway);
  const storeButton = shownHandle((await call(runtime, LOOK, {})).evidence, "Pickup or delivery?");
  page.open("signin", "Not now");
  const refused = await call(runtime, CLICK, { target: { handle: storeButton } });
  assert.equal(refused.resultCode, "web.action.rejected.blocked_by_dialog", JSON.stringify(refused.evidence));
  assert.deepEqual(page.clicks, []);
});
