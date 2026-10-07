// A replayed step whose target the site's memory removed (t195-w20b).
//
// A dry run's reset is a navigation only (decision D1), so it runs on what
// exploring left: a consent banner declined stays declined, a sign-in wall
// passed as a guest stays passed, a cart the real order emptied has no
// "Continue to checkout" (t195-w19a B1, w19b #1-#2, w19e risk 2). Core now sends
// a replayed step back with where it found the page, and a target gone from
// that very page answers `remembered`, which passes and keeps the step. Gone
// while the page is anywhere else is still `unreproducible`, which blocks --
// until Core puts the page back where the step found it (the reset, sent with
// that step's own `from`) and asks again.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const HOME = "https://example.test/";
const CHECKOUT = "https://example.test/checkout";
const PERMITTED = async () => ({ permitted: true as const });

const press = (from: JsonObject | undefined): JsonObject => {
  const value: JsonObject = { replay: "step", node: CLICK, parameters: { selector: "#guest" }, consequences: [] };
  if (from) value.from = from;
  return value;
};

test("a replayed step whose target is gone from the page it acted on is remembered, and passes", async () => {
  const site = stub(CHECKOUT);
  const runtime = createWebAutomationLlmEvidenceRuntime(site.gateway);
  const answered = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.9", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: press({ location: CHECKOUT }) });
  assert.equal(answered.resultCode, "core.replay.remembered");
  assert.equal((answered.evidence as JsonObject).ok, true);
  assert.equal(answered.resultReason, undefined);
  // The press went out and found nothing: nothing was done to the page.
  assert.equal(answered.effectApplied, false);
  assert.equal(site.commands.filter((command) => command.actionType === "web.dom.click").length, 1);
});

test("a replayed step whose target is gone while the page is elsewhere, or where it was is unknown, is unreproducible", async () => {
  for (const from of [{ location: CHECKOUT }, { location: 7 }, undefined]) {
    const site = stub(HOME);
    const runtime = createWebAutomationLlmEvidenceRuntime(site.gateway);
    const answered = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.9", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: press(from as JsonObject | undefined) });
    assert.equal(answered.resultCode, "core.replay.unreproducible", JSON.stringify(from));
    assert.equal((answered.evidence as JsonObject).ok, false, JSON.stringify(from));
  }
});

test("a re-anchor puts the page back where the step found it with one navigation, and the step is then remembered there", async () => {
  // Pickup's guest link: looked for on the cart, after "Continue to checkout"
  // was remembered, then asked again on the checkout it acted on.
  const site = stub(HOME);
  const runtime = createWebAutomationLlmEvidenceRuntime(site.gateway);
  const first = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.9", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: press({ location: CHECKOUT }) });
  assert.equal(first.resultCode, "core.replay.unreproducible");
  const back = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.9.reanchor", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: { replay: "reset", from: { location: CHECKOUT } } });
  assert.equal(back.resultCode, "core.replay.replayed");
  const again = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.9.again", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: press({ location: CHECKOUT }) });
  assert.equal(again.resultCode, "core.replay.remembered");
  const navigations = site.commands.filter((command) => command.actionType === "web.browser.navigate");
  assert.equal(navigations.length, 1);
  assert.equal(navigations[0]?.parameters.url, CHECKOUT);
});

// Run mux6n7m4 (lane A round 3, F1 fix 2): the swatch "Space Grey" was on the
// page the step acted on, and the read before the press showed it as a
// `clickable`, but the extension could not resolve it and answered not found.
// That is a control the step could not find, not one the site remembered.
const SWATCH: JsonObject = { tagName: "div", selector: "#fresh > div", accessibleName: "Space Grey", hasClickHandler: true };
const swatchPress = (element: JsonObject): JsonObject => ({
  replay: "step", node: CLICK, consequences: [], from: { location: CHECKOUT },
  parameters: { selector: "#stale > div", element }
});

test("a replayed press the page still shows by name, but could not be found, fails rather than being remembered", async () => {
  const site = stub(CHECKOUT, [SWATCH]);
  const runtime = createWebAutomationLlmEvidenceRuntime(site.gateway);
  const value = swatchPress({ tagName: "div", accessibleName: "Space Grey", selector: "#stale > div" });
  const answered = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.17", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value });
  assert.equal(answered.resultCode, "core.replay.failed");
  assert.equal((answered.evidence as JsonObject).ok, false);
  assert.match(String((answered.evidence as JsonObject).said ?? JSON.stringify(answered.evidence)), /Space Grey/u);
});

test("only a control named so counts: a label carrying the same words leaves the press remembered", async () => {
  const label: JsonObject = { tagName: "span", selector: "#color", visibleText: "Space Grey" };
  const site = stub(CHECKOUT, [label]);
  const runtime = createWebAutomationLlmEvidenceRuntime(site.gateway);
  const value = swatchPress({ tagName: "div", accessibleName: "Space Grey", selector: "#stale > div" });
  const answered = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.17", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value });
  assert.equal(answered.resultCode, "core.replay.remembered");
});

test("a press recorded in one record stays remembered when only another record shows a control of that name", async () => {
  // Bigbox's store chooser (run-munri5gr): every card holds "Set as my store";
  // the chosen card no longer does, and the others' buttons are not the step's.
  const card = (store: string, index: number): JsonObject => ({
    tagName: "button", selector: `li:nth-of-type(${index}) > button`, accessibleName: "Set as my store",
    context: { record: { text: store } }
  });
  const site = stub(CHECKOUT, [card("Ashford", 1), card("Brookside", 2)]);
  const runtime = createWebAutomationLlmEvidenceRuntime(site.gateway);
  const value = swatchPress({ tagName: "button", accessibleName: "Set as my store", selector: "li:nth-of-type(3) > button", context: { record: { text: "Millbrook" } } });
  const answered = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.8", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value });
  assert.equal(answered.resultCode, "core.replay.remembered");
  // The step's own card still holding its button is a control the step could not find.
  const own = stub(CHECKOUT, [card("Ashford", 1), card("Millbrook", 3)]);
  const again = await createWebAutomationLlmEvidenceRuntime(own.gateway).executeTool({ ...PROJECT, callId: "dryrun.1.8", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value });
  assert.equal(again.resultCode, "core.replay.failed");
});

test("a press with no accessible name is unchanged: remembered on its own page though a control is shown", async () => {
  const site = stub(CHECKOUT, [SWATCH]);
  const runtime = createWebAutomationLlmEvidenceRuntime(site.gateway);
  const value = swatchPress({ tagName: "div", selector: "#stale > div" });
  const answered = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.17", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value });
  assert.equal(answered.resultCode, "core.replay.remembered");
});

/** A page whose press target is gone, standing at `start` until a navigation moves it. */
function stub(start: string, elements?: JsonObject[]) {
  let at = start;
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push({ actionType: command.actionType, parameters: command.parameters });
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: page(at, elements) } };
      if (command.actionType === "web.browser.navigate") {
        at = String(command.parameters.url);
        return { status: "succeeded", payload: {} };
      }
      if (command.actionType === "web.dom.click") return { status: "failed", failure: { code: "web.target.not_found" }, error: "no" };
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return { gateway, commands };
}

function page(url: string, elements?: JsonObject[]): JsonObject {
  return {
    url,
    title: "Fixture",
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [{ tagName: "button", selector: "#other", visibleText: "Place order" }, ...(elements ?? [])]
  };
}
