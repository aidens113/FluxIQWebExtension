// A candidate may name only a handle some evidence printed (t378, lane B C4).
//
// Live (`run-mv0fu9pb-57454dc4`, 0058): the candidate's product-page steps
// named `t551`, `t560` and `t570`. No page view, search or tool result had ever
// printed them: the search page's view (0018) printed `t550` and `t555`, and
// the numbers between were elements of that capture the view leaves out --
// wordless wrappers of a product card. The store holds every element of a
// capture, so under the view history each resolved, silently, to a card
// wrapper on a page the step was not on.
//
// Held here: under `view_history` a handle is resolved only when a page view
// printed it, or a search or description printed it; any other is `not_shown`
// in the store and refused `web.handle.unknown` -- to the model, a handle no
// packet it read carried. Exploration's own node runs keep the store as it was.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DESCRIBE_ELEMENT_TOOL_ID,
  WEB_LLM_FIND_ON_PAGE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebLlmEvidenceGateway
} from "../..";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { createWebLlmStableTargetHandles } from "../../stable-handles";
import { createWebLlmExtractionHandles } from "../../structure";
import { webLlmPageText } from "../../page-view";
import { createWebLlmTargetPackets, resolveWebPlanNodeParameters, type WebPlanNodeResolutionInput } from "..";

const SCOPE = { projectId: "project.printed", flowId: "flow.printed" };
const SEARCH = "https://bigbox.test/search?q=paper+towels";
const CHECK = webAutomationOutputNodeId("web.dom.check");
const CLICK = webAutomationOutputNodeId("web.dom.click");

/** One product card as the search page drew it: a link, then a wordless wrapper and an image holder, then the price. */
const CARD: JsonObject[] = [
  { tagName: "a", selector: "#card-2 > a", visibleText: "ValueRidge Ultra Dish Soap, Lemon Scent, 24 fl oz", attributes: { href: "/ip/dish-soap" } },
  { tagName: "div", selector: "#card-2 > div.media" },
  { tagName: "div", selector: "#card-2 > div.media > span.badge" },
  { tagName: "span", selector: "#card-2 > span.price", visibleText: "$3.97" }
];

function input(nodeDefinitionId: string, parameters: JsonObject, extra: Partial<WebPlanNodeResolutionInput> = {}): WebPlanNodeResolutionInput {
  return { ...SCOPE, nodeDefinitionId, parameters, declaredConsequences: [], permission: async () => ({ permitted: true as const }), ...extra };
}

function shownSearchPage() {
  const targets = createWebLlmTargetPackets();
  const capture = createWebLlmStableTargetHandles().restamp(SCOPE, sanitizeWebLlmSnapshotWithBindings({ url: SEARCH, interactiveElements: CARD }));
  targets.remember(SCOPE, capture);
  const handleOf = (selector: string): string => {
    const found = capture.evidence.elements.find((element) => capture.selectors.get(element.target) === selector);
    if (found === undefined) throw new Error(`no handle for ${selector}`);
    return found.target;
  };
  return { targets, capture, handleOf, stores: { targets, extractions: createWebLlmExtractionHandles() } };
}

test("a candidate step naming a handle the store holds but no page view printed is refused web.handle.unknown, never resolved", async () => {
  const { targets, capture, handleOf, stores } = shownSearchPage();
  const wrapper = handleOf("#card-2 > div.media");
  const link = handleOf("#card-2 > a");
  const page = webLlmPageText(capture.evidence);
  assert.match(page, new RegExp(`^${link} link`, "mu"), "the view prints the link");
  assert.doesNotMatch(page, new RegExp(`\\b${wrapper}\\b`, "u"), "the view leaves the wordless wrapper out, as 0018 left t551 out");

  const store = targets.resolve(SCOPE, wrapper, undefined, "view_history");
  assert.deepEqual(store, { ok: false, code: "not_shown" });
  const answer = await resolveWebPlanNodeParameters(input(CHECK, { target: { handle: wrapper }, checked: true }, { handleReach: "view_history" }), stores);
  assert.equal(answer.status, "refused", JSON.stringify(answer));
  if (answer.status !== "refused") return;
  assert.equal(answer.issueCodes[0], "web.handle.unknown");
  assert.ok(answer.issueCodes.includes("web.handle.unknown:target"), JSON.stringify(answer.issueCodes));

  // Located on the page that holds it: still never printed.
  assert.deepEqual(targets.resolve(SCOPE, wrapper, SEARCH, "view_history"), { ok: false, code: "not_shown" });
});

test("a candidate step naming a handle the view printed still resolves from the view history", async () => {
  const { handleOf, stores } = shownSearchPage();
  const link = handleOf("#card-2 > a");
  const answer = await resolveWebPlanNodeParameters(input(CLICK, { target: { handle: link } }, { handleReach: "view_history" }), stores);
  assert.equal(answer.status, "resolved", JSON.stringify(answer));
  if (answer.status !== "resolved") return;
  assert.equal(answer.parameters.selector, "#card-2 > a");
});

test("a handle no capture ever carried stays web.handle.unknown", async () => {
  const { targets } = shownSearchPage();
  assert.deepEqual(targets.resolve(SCOPE, "t551", undefined, "view_history"), { ok: false, code: "unknown" });
});

test("exploration's own node runs resolve against the pages as before: only a candidate is held to what was printed", () => {
  const { targets, handleOf } = shownSearchPage();
  const resolution = targets.resolve(SCOPE, handleOf("#card-2 > div.media"), undefined);
  assert.equal(resolution.ok, true, JSON.stringify(resolution));
});

/** A page whose account menu is closed: its items are listed only when a capture asks for hidden elements. */
function site(): WebLlmEvidenceGateway {
  return {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const visible = [
        { tagName: "button", selector: "#account", accessibleName: "Account" },
        { tagName: "a", selector: "#home", accessibleName: "Home", attributes: { href: "/home" } }
      ];
      const hidden = [
        { tagName: "a", selector: "#orders", accessibleName: "Your orders", attributes: { href: "/orders" }, hidden: true },
        { tagName: "a", selector: "#sign-out", accessibleName: "Sign out", attributes: { href: "/sign-out" }, hidden: true }
      ];
      const interactiveElements = command.parameters.includeHidden === true ? [...visible, ...hidden] : visible;
      return { status: "succeeded", payload: { snapshot: { url: "https://shop.test/home", title: "Shop", interactiveElements } } };
    }
  };
}

test("a handle a search or a description printed is one a candidate may name; one the same capture held unprinted is not", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(site());
  const call = (callId: string, toolId: string, value: JsonObject) => runtime.executeTool({ ...SCOPE, callId, toolId, value });
  const candidate = (handle: string) => runtime.resolvePlanNodeParameters(input(CLICK, { target: { handle } }, { handleReach: "view_history" }));

  const looked = await call("call.look", WEB_LLM_RUN_NODE_TOOL_ID, { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] });
  assert.match(String((looked.evidence as { page: string }).page), /^t1 button "Account"$/mu);
  const found = await call("call.find", WEB_LLM_FIND_ON_PAGE_TOOL_ID, { query: "your orders" });
  assert.match((found.evidence as { found: string }).found, /^t3 link "Your orders"/mu);
  assert.doesNotMatch((found.evidence as { found: string }).found, /\bt4\b/u, "the search printed only its match");

  assert.equal((await candidate("t1")).status, "resolved", "printed by the page view");
  assert.equal((await candidate("t3")).status, "resolved", "printed by the search");
  const unprinted = await candidate("t4");
  assert.equal(unprinted.status, "refused", JSON.stringify(unprinted));
  if (unprinted.status === "refused") assert.equal(unprinted.issueCodes[0], "web.handle.unknown");

  // Describing it prints it, and then it may be named.
  const described = await call("call.describe", WEB_LLM_DESCRIBE_ELEMENT_TOOL_ID, { target: "t4" });
  assert.equal(described.resultCode, "web.inspect.succeeded", JSON.stringify(described.evidence));
  assert.equal((await candidate("t4")).status, "resolved", "printed by the description");
});
