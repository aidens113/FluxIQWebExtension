// A press through a layer, and a handle a layer took away (t223; C1, C3, C4
// and C9 of `run-mup2i28c-6c7fc209`). The store page of that run, small: a
// store button, then a timed email popup that opens over it.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";
import { shownHandle, shownPageLines } from "../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.covered", flowId: "flow.covered" } as const;
const URL = "https://shop.example/store";
const LOOK = "web.output.dom-capture_snapshot";
const CLICK = "web.output.dom-click";

/** `banner`: a layer beside the main column that covers nothing, as a cookie banner at the foot of the page. */
type Layer = "none" | "popup" | "dialog" | "banner" | "overlap";

/** The store page with the main column under `body`, and the layer the test opens beside it. */
function store(): { gateway: WebLlmEvidenceGateway; clicks: string[]; open(layer: Layer): void } {
  let layer: Layer = "none";
  const clicks: string[] = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.click") {
        clicks.push(String(command.parameters.selector));
        if (command.parameters.selector === "body > div:nth-of-type(1) > button") layer = "none";
        return { status: "succeeded" };
      }
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      return { status: "succeeded", payload: { snapshot: snapshot(layer) } };
    }
  };
  return { gateway, clicks, open: (next) => { layer = next; } };
}

function snapshot(layer: Layer): JsonObject {
  const main = layer === "none" ? "body > div" : "body > div:nth-of-type(2)";
  const storeButton = `${main} > header > button`;
  const elements: JsonObject[] = [
    { tagName: "button", selector: storeButton, visibleText: "Pickup or delivery?" },
    { tagName: "a", selector: `${main} > main > a`, visibleText: "Wireless earbuds", attributes: { href: "/p/1" } }
  ];
  if (layer === "none") return { url: URL, title: "Store", interactiveElements: elements };
  const cover = "body > div:nth-of-type(1)";
  const layerElement: JsonObject = layer === "dialog"
    ? { tagName: "div", selector: cover, role: "dialog", accessibleName: "Choose a store" }
    : { tagName: "div", selector: cover, accessibleName: "Get $10 off your first pickup order" };
  const popup: JsonObject[] = [layerElement, { tagName: "button", selector: `${cover} > button`, visibleText: "No thanks" }];
  const evidence: JsonObject = layer === "banner" ? {} : {
    overlays: { tested: 3, blockedCount: 2, blockers: [{ selector: cover, label: layer === "dialog" ? "Choose a store" : "Get $10 off your first pickup order", blocks: 2, blocked: [storeButton, `${main} > main > a`], kind: layer === "overlap" ? undefined : layer === "dialog" ? "consent" : "promotion" }] }
  };
  if (layer === "dialog") evidence.dialogs = { open: [{ selector: cover, role: "dialog", label: "Choose a store", modal: true }] };
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

test("a timed popup opens over the control: the press is refused before it is sent, naming the cover, with the page, and the handle stays the same", async () => {
  const page = store();
  const runtime = createWebAutomationLlmEvidenceRuntime(page.gateway);
  const looked = await call(runtime, LOOK, {});
  const storeButton = shownHandle(looked.evidence, "Pickup or delivery?");

  // The popup opens on a timer, after the look the model read (C9).
  page.open("popup");
  const refused = await call(runtime, CLICK, { target: { handle: storeButton } });
  assert.equal(refused.resultCode, "web.action.rejected.target_covered");
  assert.equal(refused.effectApplied, false);
  assert.deepEqual(page.clicks, [], "nothing was sent through the popup (C4)");
  const evidence = refused.evidence as { detail: { reason: string; target: string; instead: string[] }; page: { schemaVersion: string; page: string } };
  assert.equal(evidence.detail.reason, "covered_by_layer");
  assert.equal(evidence.detail.target, storeButton, "the control kept its handle behind the popup (C1)");
  // The page comes back with the popup in it, and names it (C3, C9).
  assert.equal(evidence.page.schemaVersion, "web-llm-page.v3");
  const cover = evidence.detail.instead[0]!;
  assert.match(evidence.page.page, new RegExp(`^COVERING ${cover} "Get \\$10 off your first pickup order"`, "mu"));
  assert.match(evidence.page.page, new RegExp(`^${storeButton} button "Pickup or delivery\\?" covered-by ${cover}$`, "mu"));

  // The popup's own control, from the page the refusal handed back, is pressed next.
  const dismissed = await call(runtime, CLICK, { target: { handle: shownHandle(evidence, "No thanks") } });
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

test("a modal dialog over the control refuses the press as blocked_by_dialog, naming the dialog", async () => {
  const page = store();
  const runtime = createWebAutomationLlmEvidenceRuntime(page.gateway);
  const storeButton = shownHandle((await call(runtime, LOOK, {})).evidence, "Pickup or delivery?");
  page.open("dialog");
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
