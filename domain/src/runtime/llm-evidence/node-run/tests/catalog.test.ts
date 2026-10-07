// The name a call wrote is resolved against the catalog, not looked up in it.
//
// The ids invite being written slightly wrong: `web.dom.extract_list` becomes
// `web.output.dom-extract_list`, because the id builder turns dots into
// hyphens and leaves underscores alone, so the plain kebab-case form a model
// reaches for names nothing. Before a miss fell through to a matcher, that
// cost a paid provider call per attempt and the model did not recover --
// `run-mug776kx-0214b287` was refused `node_not_runnable_here` fourteen times
// in a row. What these cover is the other half of that: a name nobody wrote a
// near version of must still be unknown, or the correction becomes noise.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, webRunnableNode, webRunnableNodeIds, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const START = "https://store.test/catalogue";
const NAVIGATE = "web.output.browser-navigate";
const CLICK = "web.output.dom-click";
const EXTRACT_LIST = "web.output.dom-extract_list";

test("the id written exactly is the node, and what comes back is the catalog's own entry", () => {
  const node = webRunnableNode(EXTRACT_LIST);
  assert.equal(node?.definitionId, EXTRACT_LIST);
  assert.equal(node?.actionType, "web.dom.extract_list");
  assert.equal(node?.effect, "observe");
  assert.equal(node?.proposes, true);
});

test("the kebab-case form a model writes for an underscored id resolves to it", () => {
  // The three spellings a model actually produces for this id. None of them is
  // the id, and all of them mean it.
  assert.equal(webRunnableNode("web.output.dom-extract-list")?.definitionId, EXTRACT_LIST);
  assert.equal(webRunnableNode("web.output.dom_extract_list")?.definitionId, EXTRACT_LIST);
  assert.equal(webRunnableNode("webOutputDomExtractList")?.definitionId, EXTRACT_LIST);
  // And not the neighbouring node whose id is a prefix of it.
  assert.equal(webRunnableNode("web.output.dom-extract")?.definitionId, "web.output.dom-extract");
});

test("case is not a different name", () => {
  assert.equal(webRunnableNode("WEB.OUTPUT.DOM-CLICK")?.definitionId, CLICK);
  assert.equal(webRunnableNode("Web.Output.Dom-Click")?.definitionId, CLICK);
});

test("a name written short finds the node it meant", () => {
  assert.equal(webRunnableNode("navigate")?.definitionId, NAVIGATE);
  assert.equal(webRunnableNode("click-element")?.definitionId, CLICK);
});

test("a name nothing plausible was written for is still unknown", () => {
  // `node_not_runnable_here` has to stay reachable, or a refusal that means
  // something becomes a wrong node silently dispatched.
  assert.equal(webRunnableNode("banana"), undefined);
  assert.equal(webRunnableNode("sendEmail"), undefined);
  assert.equal(webRunnableNode("builtin.logic.and"), undefined);
  assert.equal(webRunnableNode(""), undefined);
  assert.equal(webRunnableNode("   "), undefined);
  assert.equal(webRunnableNode(undefined), undefined);
  assert.equal(webRunnableNode(42), undefined);
});

test("the list a refusal offers is the catalog's ids and nothing a call wrote", () => {
  const ids = webRunnableNodeIds();
  assert.equal(ids.includes(EXTRACT_LIST), true);
  assert.equal(ids.includes("web.output.dom-extract-list"), false);
  assert.deepEqual(ids, [...ids].sort());
});

test("a name written wrong runs the real command and appends the step under the real id", async () => {
  const stubbed = blankTab();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);

  const went = await runtime.executeTool({
    ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    // A dot where the id has a hyphen: the likeliest way to write this one.
    value: { node: "web.output.browser.navigate", parameters: { url: START }, consequences: [] }
  });

  assert.equal(went.resultCode, "web.action.succeeded");
  // The command that went to the page is the resolved node's, not a guess.
  assert.deepEqual(stubbed.commands.map((command) => command.actionType), ["web.dom.capture_snapshot", "web.browser.navigate", "web.dom.capture_snapshot"]);
  // And the step the Flow gains carries the catalog's id. A draft holding a
  // name the registry does not have would build a Flow that cannot execute.
  assert.equal(went.draft?.actionId, NAVIGATE);
  assert.equal(went.draft?.proposes, true);
  // The written form survives only inside the opaque call JSON Core carries
  // without reading and hands back here for a replay -- which resolves it
  // through this same function, so the replay runs the same node this did.
  const ranWith = went.draft?.ranWith as JsonObject;
  assert.equal(ranWith.node, "web.output.browser.navigate");
  assert.equal(webRunnableNode(ranWith.node)?.definitionId, NAVIGATE);
});

// S4 of the read-list redesign (contract C1): Next page is a node of this
// domain's library like any other, so the build can run it while exploring and
// the build's test can run it again; nothing here lists it by hand.
const NEXT_PAGE = "web.output.dom-next_page";

test("Next page is runnable: its own command, a step that changes the page, and one the Flow keeps", () => {
  const node = webRunnableNode(NEXT_PAGE);
  assert.equal(node?.definitionId, NEXT_PAGE);
  assert.equal(node?.actionType, "web.dom.next_page");
  assert.equal(node?.effect, "mutate");
  assert.equal(node?.proposes, true);
  assert.equal(webRunnableNodeIds().includes(NEXT_PAGE), true);
  // The kebab-case spelling a model writes for the underscored id.
  assert.equal(webRunnableNode("web.output.dom-next-page")?.definitionId, NEXT_PAGE);
  // And the bound runtime offers it, so Core's run_node can name it.
  const runtime = createWebAutomationLlmEvidenceRuntime(blankTab().gateway);
  assert.equal(runtime.runsNodes?.runnable?.includes(NEXT_PAGE), true);
});

test("Next page's catalog text holds Core's bounds: 240 for the description, 80 for its first sentence, 700 for a parameter", () => {
  const definition = webRunnableNode(NEXT_PAGE)!.definition;
  const description = definition.description ?? "";
  assert.equal(description.length > 0 && description.length <= 240, true, `${description.length} characters`);
  const firstSentence = description.split(/(?<=\.)\s/u)[0] ?? "";
  assert.equal(firstSentence.length > 0 && firstSentence.length <= 80, true, firstSentence);
  for (const parameter of definition.parameters) {
    assert.equal((parameter.description ?? "").length <= 700, true, `${parameter.id}: ${(parameter.description ?? "").length} characters`);
  }
  // One step moves one page: nothing it teaches is a page budget.
  assert.doesNotMatch(`${description} ${definition.parameters.map((parameter) => parameter.description ?? "").join(" ")}`, /maxPages: \d|maxScrolls/u);
});

test("an exploration run of Next page dispatches its request as the Flow's node will", async () => {
  const stubbed = blankTab();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  await runtime.executeTool({ ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START, value: { node: NAVIGATE, parameters: { url: START }, consequences: [] } });
  const nextPage = { item: "li.result", pagination: { next: "a.next" } };
  const moved = await runtime.executeTool({ ...PROJECT, callId: "call.two", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START, value: { node: NEXT_PAGE, parameters: { nextPage }, consequences: [] } });
  assert.equal(moved.resultCode, "web.action.succeeded");
  const sent = stubbed.commands.find((command) => command.actionType === "web.dom.next_page");
  assert.deepEqual(sent?.parameters.nextPage, nextPage);
  assert.equal(moved.draft?.actionId, NEXT_PAGE);
});

/** The blank tab and the one site it can reach (`./start-location.test.ts`). */
function blankTab() {
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  let location: string | undefined;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push({ actionType: command.actionType, parameters: command.parameters });
      if (command.actionType === "web.browser.navigate") {
        location = String(command.parameters.url);
        return { status: "succeeded", payload: { value: "ok" } };
      }
      if (command.actionType === "web.dom.capture_snapshot") {
        return location === undefined
          ? { status: "failed", error: "Browser and extension pages cannot be automated." }
          : { status: "succeeded", payload: { snapshot: page(location) } };
      }
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return { gateway, commands };
}

function page(url: string): JsonObject {
  return {
    url,
    title: "Catalogue",
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [{ tagName: "button", selector: "#go", visibleText: "Go" }]
  };
}
