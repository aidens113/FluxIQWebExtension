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

/** A page whose press target is gone, standing at `start` until a navigation moves it. */
function stub(start: string) {
  let at = start;
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push({ actionType: command.actionType, parameters: command.parameters });
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: page(at) } };
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

function page(url: string): JsonObject {
  return {
    url,
    title: "Fixture",
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [{ tagName: "button", selector: "#other", visibleText: "Place order" }]
  };
}
