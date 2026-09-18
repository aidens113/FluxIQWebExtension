// A target handle keeps naming one control while a page is recaptured.
//
// The measurement this exists for: with `[banner, beds, band, search]`,
// `target.2` resolved to the Bedrooms select; the banner was dismissed, the
// page recaptured, and the same `target.2` resolved to the Price-band select
// with no refusal anywhere. Live, a created Flow chose a filter's handle and
// the run failed with `expected a select element to choose value "5" in, actual
// the target is a <button>` (`run-mu6btt9u-8ba762fd`). The rows below hold both
// halves: what the model is shown, and what the plan resolver answers.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_INSPECT_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "..";

const PAGE_URL = "https://example.test/search";
const OTHER_URL = "https://example.test/other";
const CLICK_NODE = webAutomationOutputNodeId("web.dom.click");

const banner: JsonObject = { tagName: "button", selector: "#cookies", visibleText: "Got it" };
const beds: JsonObject = { tagName: "select", selector: "#beds", accessibleName: "Bedrooms" };
const band: JsonObject = { tagName: "select", selector: "#band", accessibleName: "Price band" };
const search: JsonObject = { tagName: "button", selector: "#search", visibleText: "Search" };

/** A runtime whose page is whatever the test says it is now. */
function runtimeOver(page: () => { url: string; elements: JsonObject[] }): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const current = page();
      return { status: "succeeded", payload: { snapshot: { url: current.url, title: "Fixture", interactiveElements: current.elements } } };
    }
  });
}

let calls = 0;
async function inspect(runtime: WebAutomationLlmEvidenceRuntime): Promise<Array<{ target: string; name: string }>> {
  calls += 1;
  const result = await runtime.executeTool({ projectId: "p", flowId: "f", callId: `call.${calls}`, toolId: WEB_LLM_INSPECT_TOOL_ID, value: {} });
  const elements = (result as unknown as { evidence: { elements: Array<{ target: string; name?: string; text?: string }> } }).evidence.elements;
  return elements.map((element) => ({ target: element.target, name: element.name ?? element.text ?? "" }));
}

function selectorFor(runtime: WebAutomationLlmEvidenceRuntime, handle: string): string | undefined {
  const resolved = runtime.resolvePlanNodeParameters({ projectId: "p", flowId: "f", nodeDefinitionId: CLICK_NODE, parameters: { target: { handle } } });
  return resolved.status === "resolved" ? resolved.parameters.selector as string : undefined;
}

test("a control keeps its handle when the page around it is recaptured", async () => {
  let elements = [banner, beds, band, search];
  const runtime = runtimeOver(() => ({ url: PAGE_URL, elements }));

  const first = await inspect(runtime);
  assert.deepEqual(first, [
    { target: "target.1", name: "Got it" },
    { target: "target.2", name: "Bedrooms" },
    { target: "target.3", name: "Price band" },
    { target: "target.4", name: "Search" }
  ]);
  assert.equal(selectorFor(runtime, "target.2"), "#beds");

  // The banner is dismissed, exactly as a successful reveal leaves the page,
  // and the page is captured again.
  elements = [beds, band, search];
  const second = await inspect(runtime);
  assert.deepEqual(second, [
    { target: "target.2", name: "Bedrooms" },
    { target: "target.3", name: "Price band" },
    { target: "target.4", name: "Search" }
  ], "the surviving controls keep the numbers the model already read");
  assert.equal(selectorFor(runtime, "target.2"), "#beds", "and the plan resolver still answers with the same control");
  assert.equal(selectorFor(runtime, "target.4"), "#search");
});

test("a control the page adds is given a number the page has never spent", async () => {
  let elements = [beds, search];
  const runtime = runtimeOver(() => ({ url: PAGE_URL, elements }));
  assert.deepEqual((await inspect(runtime)).map((element) => element.target), ["target.1", "target.2"]);

  elements = [beds, band, search];
  const grown = await inspect(runtime);
  assert.deepEqual(grown, [
    { target: "target.1", name: "Bedrooms" },
    { target: "target.3", name: "Price band" },
    { target: "target.2", name: "Search" }
  ], "the new control takes the next free number rather than one already read");
  assert.equal(selectorFor(runtime, "target.2"), "#search");
  assert.equal(selectorFor(runtime, "target.3"), "#band");
});

test("another page numbers from the start, because handles never mean anything across pages", async () => {
  let page = { url: PAGE_URL, elements: [banner, beds] };
  const runtime = runtimeOver(() => page);
  await inspect(runtime);
  page = { url: OTHER_URL, elements: [search] };
  assert.deepEqual((await inspect(runtime)).map((element) => element.target), ["target.1"]);
});
