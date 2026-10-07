// The "Next page" output node (contract C1): `web.output.dom-next_page` shows
// the next page of a detected list, or answers `ended` when there is none. It
// is not an element target, it changes the page (pressing twice moves two
// pages), and it declares the `ended` branch Core routes a list's end down.
// Its node refuses a request that does not parse before anything is sent, and
// sends its own timeout as the dispatch's, as the list extraction does.

import assert from "node:assert/strict";
import test from "node:test";
import { validateAutomationStudioNodeDefinition } from "fluxiq/automation-studio/nodes";
import type { AutomationNodeExecutionResult, AutomationStudioNativeNodeContext } from "fluxiq/automation-studio/nodes";
import type { JsonValue } from "fluxiq/core";
import { webAutomationActionEffect } from "../../actions/effect";
import { WEB_AUTOMATION_ACTION_TO_LEGACY_BROWSER, WEB_AUTOMATION_ACTION_TYPES } from "../../actions/types";
import { webAutomationOutputNodeDefinitions, webAutomationOutputNodeId } from "../definitions";
import { createWebAutomationOutputNodeImplementationBundle } from "../native-runtime";

const node = webAutomationOutputNodeDefinitions.find((definition) => definition.outputAction?.fixedOutputId === "web.dom.next_page");

test("the action is registered under its own type and legacy alias", () => {
  assert.equal(WEB_AUTOMATION_ACTION_TYPES.includes("web.dom.next_page"), true);
  assert.equal(WEB_AUTOMATION_ACTION_TO_LEGACY_BROWSER["web.dom.next_page"], "dom.next_page");
  assert.equal(webAutomationActionEffect("web.dom.next_page"), "mutate");
});

test("the node is web.output.dom-next_page, labelled Next page, and valid", () => {
  assert.ok(node, "web.dom.next_page has no output node");
  assert.equal(node.id, "web.output.dom-next_page");
  assert.equal(webAutomationOutputNodeId("web.dom.next_page"), "web.output.dom-next_page");
  assert.equal(node.label, "Next page");
  const validation = validateAutomationStudioNodeDefinition(node);
  assert.equal(validation.ok, true, validation.issues.map((issue) => issue.code).join(", "));
});

test("the node routes success, failed and ended, and ended is a branch", () => {
  assert.ok(node);
  assert.deepEqual(node.outputs.map((port) => [port.id, port.role]), [["success", "success"], ["failed", "failure"], ["ended", "branch"]]);
});

test("the node changes the page and is not an element target", () => {
  assert.ok(node);
  assert.equal(node.metadata?.effect, "mutate");
  assert.equal(Object.hasOwn(node.metadata ?? {}, "elementTarget"), false);
  assert.deepEqual(node.inputs.map((port) => port.id), ["in"], "no item input: there is no element to scope to a row");
  assert.equal(Object.hasOwn(node.metadata ?? {}, "recordsPath"), false);
});

test("the node takes a structured nextPage and a 30 s timeout", () => {
  assert.ok(node);
  const nextPage = node.parameters.find((parameter) => parameter.id === "nextPage");
  assert.ok(nextPage, "no nextPage parameter");
  assert.equal(nextPage.valueType, "object");
  assert.equal(nextPage.required, true);
  const timeout = node.parameters.find((parameter) => parameter.id === "timeoutMs");
  assert.equal(timeout?.valueType, "number");
  assert.equal(timeout?.defaultValue, 30_000);
  assert.equal(typeof node.description === "string" && /next page/iu.test(node.description), true);
  for (const tag of ["next page", "load more", "pagination"]) assert.equal(node.tags?.includes(tag), true, `missing tag ${tag}`);
});

const bundle = createWebAutomationOutputNodeImplementationBundle();

async function execute(parameters: Record<string, JsonValue>): Promise<AutomationNodeExecutionResult> {
  const implementation = bundle.implementations["web.dom.next_page"];
  assert.ok(implementation, "web.dom.next_page has no bound implementation");
  const context = { inputs: {}, parameters, log: () => undefined } as unknown as AutomationStudioNativeNodeContext;
  return await implementation(context);
}

test("a node whose nextPage does not parse is refused before anything is sent", async () => {
  for (const nextPage of [undefined, { item: "" }, { item: "li.result", pagination: { next: "a.next", maxPages: 3 } }, { list: "extraction.1" }] as JsonValue[]) {
    const result = await execute(nextPage === undefined ? {} : { nextPage });
    assert.equal(result.status, "failed", JSON.stringify(nextPage));
    assert.equal(result.route, "failed");
    assert.deepEqual(result.effects, []);
    assert.equal(result.failure?.category, "graph_validation_or_unknown_node");
    assert.equal(result.failure?.stage, "dispatch");
    assert.equal(result.failure?.retryable, false);
  }
});

test("a valid nextPage is dispatched with the node's timeout as the dispatch's own", async () => {
  const nextPage = { item: "li.result", pagination: { mode: "loadMore", control: "button.more" } };
  const defaulted = await execute({ nextPage });
  assert.equal(defaulted.status, "success");
  assert.deepEqual(defaulted.effects, [{
    type: "policy.output.dispatch",
    payload: { outputId: "web.dom.next_page", parameters: { nextPage, timeoutMs: 30_000 }, timeoutMs: 30_000 }
  }]);
  const authored = await execute({ nextPage, timeoutMs: 45_000 });
  assert.deepEqual(authored.effects?.[0]?.payload, { outputId: "web.dom.next_page", parameters: { nextPage, timeoutMs: 45_000 }, timeoutMs: 45_000 });
});
