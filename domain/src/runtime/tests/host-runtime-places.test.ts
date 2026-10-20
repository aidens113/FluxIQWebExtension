// The host runtime's state diff names where the step's control sat and the
// items of the lists both pages show (t609), the keys FluxIQ Core ties a
// trial's act to its own item by (t598) -- and its snapshots' summaries, which
// a recovery model is shown, carry neither. The site is a recipe box: saved
// recipes in a list, and a recipe card whose Save adds one.

import assert from "node:assert/strict";
import test from "node:test";
import type { OutputDispatchResult } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { automationStudioActionPermissionDenied } from "fluxiq/automation-studio";
import { webAutomationOutputNodeId } from "../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime } from "../llm-evidence";
import { createWebAutomationHostRuntime, type WebAutomationHostRuntimeGateway } from "../host-runtime";

const CLICK_NODE_ID = webAutomationOutputNodeId("web.dom.click");
const ORIGIN = 1_760_000_000_000.5;

/** The recipe box page with the saved recipes `saved`, each line named by its words, beside one recipe card. */
function box(saved: string[], url = "https://recipes.test/box", timeOrigin = ORIGIN): JsonObject {
  const elements: JsonObject[] = [
    { tagName: "main", selector: "main" },
    { tagName: "article", selector: "#card", parent: 0, context: { record: { keyAttribute: "data-recipe-id", key: "rye-loaf" } } },
    { tagName: "button", selector: "#card > button", name: "Save", parent: 1, context: { record: { keyAttribute: "data-recipe-id", key: "rye-loaf" } } },
    { tagName: "ul", selector: "#saved", parent: 0, attributes: { class: "saved" } }
  ];
  saved.forEach((words, index) => {
    const record = { text: words };
    elements.push({ tagName: "li", selector: `#saved > li:nth-of-type(${index + 1})`, parent: 3, text: words, context: { record } });
  });
  const snapshot = { url, title: "Recipe box", interactiveElements: elements, evidence: { navigation: { url, origin: "https://recipes.test", path: "/box", historyLength: 1, visibility: "visible", timeOrigin } } };
  return { ok: true, status: "succeeded", payload: { status: "succeeded", result: { snapshot } } };
}

function seam(pages: JsonObject[]): WebAutomationHostRuntimeGateway {
  let read = 0;
  return { dispatch: async (request) => ({ outputId: request.outputId, ...pages[read++] }) as OutputDispatchResult<JsonObject> };
}

const node = { id: "save", definitionId: CLICK_NODE_ID, parameterValues: { selector: "#card > button" } };
const capture = (point: "before_action" | "after_action", attemptId = "save.attempt.1") => ({ node, attemptId, inputs: {}, point } as const);

test("a step's diff names its control's spot and the line it added, and no summary carries either", async () => {
  const boundary = createWebAutomationHostRuntime(seam([box(["Oat porridge", "Pea soup"]), box(["Oat porridge", "Pea soup", "Rye loaf"])]));
  const before = await boundary.captureStateSnapshot!(capture("before_action"));
  const after = await boundary.captureStateSnapshot!(capture("after_action"));
  const diff = await boundary.inspectStateDiff!({ before, after, node, attemptId: "save.attempt.1" });

  const spot = diff.spot as { item?: string };
  assert.match(String(spot.item), /^i:[0-9a-f]{32}$/u);
  const items = diff.items as { before: string[]; after: string[] };
  const made = items.after.filter((item) => !items.before.includes(item));
  assert.equal(made.length, 1);
  assert.notEqual(made[0], spot.item);
  // The view and every line diff as before.
  assert.equal(diff.documentChanged, false);
  assert.equal(diff.addedCount, 1);
  for (const ref of [before, after]) assert.doesNotMatch(JSON.stringify(ref.summary), /i:[0-9a-f]{32}|#saved|nth-of-type/u);
  assert.doesNotMatch(JSON.stringify(diff), /#saved|nth-of-type|data-recipe-id/u);
});

test("the page the previous step ended on keeps its places, a move to another document names no items, and an unknown ref names neither key", async () => {
  const boundary = createWebAutomationHostRuntime(seam([box(["Oat porridge", "Pea soup"]), box(["Oat porridge"], "https://recipes.test/recipes/rye-loaf", ORIGIN + 9)]));
  const ended = await boundary.captureStateSnapshot!(capture("after_action", "open.attempt.1"));
  // Offered back at the next step's start, it is answered as it is (t480), and its places with it.
  const started = await boundary.captureStateSnapshot!({ ...capture("before_action"), previousStateRef: ended });
  assert.equal(started, ended);
  const moved = await boundary.captureStateSnapshot!(capture("after_action"));
  const diff = await boundary.inspectStateDiff!({ before: started, after: moved, node, attemptId: "save.attempt.1" });
  assert.equal(diff.documentChanged, true);
  assert.match(String((diff.spot as { item?: string }).item), /^i:/u);
  assert.equal(diff.items, undefined);

  const restored = { ...started, stateRef: "web.state.99@saved:before_action" };
  const blind = await boundary.inspectStateDiff!({ before: restored, after: { ...moved, stateRef: "web.state.98@saved:after_action" }, node, attemptId: "save.attempt.1" });
  assert.equal(blind.spot, undefined);
  assert.equal(blind.items, undefined);
});


test("trial and exploration scopes agree on trusted session/tab identity and never publish its raw metadata", async () => {
  const snapshot: JsonObject = { url: "https://recipes.test/box", title: "Recipe box", interactiveElements: [
    { tagName: "div", role: "list", selector: "#saved" },
    { tagName: "div", role: "listitem", selector: "#row", parent: 0, attributes: { "aria-setsize": "1", "aria-posinset": "1" } },
    { tagName: "button", selector: "#remove", parent: 1, visibleText: "Remove", context: { subject: "A recipe" } }
  ] };
  const answer = (sourceId: string): JsonObject => ({ ok: true, metadata: { sessionId: "session.one" }, payload: { result: { snapshot, sourceId } } });
  const boundary = createWebAutomationHostRuntime(seam([answer("tab:1:frame:0"), answer("tab:1:frame:0"), answer("tab:2:frame:0"), answer("tab:2:frame:0")]));
  const ownNode = { ...node, parameterValues: { selector: "#remove" } };
  const first = await boundary.captureStateSnapshot!({ ...capture("before_action"), node: ownNode });
  const second = await boundary.captureStateSnapshot!({ ...capture("after_action"), node: ownNode });
  const diff = await boundary.inspectStateDiff!({ before: first, after: second, node: ownNode, attemptId: "save.attempt.1" });
  const exploration = createWebAutomationLlmEvidenceRuntime({ eligibleSessionIds: () => ["session.one"], executeAction: async () => ({ status: "succeeded", payload: { snapshot, sourceId: "tab:1:frame:0" } }) });
  const observed = await exploration.startState!({ projectId: "project", flowId: "flow", callId: "look", permission: automationStudioActionPermissionDenied });
  assert.equal((diff.spot as JsonObject).scope, observed!.collections![0]!.scope);
  assert.match(String((diff.spot as JsonObject).scope), /^p:[0-9a-f]{32}$/u);
  const third = await boundary.captureStateSnapshot!({ ...capture("before_action", "another"), node: ownNode });
  const fourth = await boundary.captureStateSnapshot!({ ...capture("after_action", "another"), node: ownNode });
  const other = await boundary.inspectStateDiff!({ before: third, after: fourth, node: ownNode, attemptId: "another" });
  assert.notEqual((other.spot as JsonObject).scope, (diff.spot as JsonObject).scope);
  assert.doesNotMatch(JSON.stringify(first.summary), /session\.one|tab:1:frame:0|sourceId|resetResource|p:[0-9a-f]{32}/u);
});

// Job rerun round 4: a loop pass's diff is given the attempt's inputs, and its
// spot is the pass row's recipe, not the one the step was recorded on.
test("a loop pass's diff places its control in the pass row the attempt's inputs carry", async () => {
  const cards = (): JsonObject => {
    const elements: JsonObject[] = [{ tagName: "main", selector: "main" }];
    const rows: ReadonlyArray<readonly [string, string]> = [["Rye loaf", "Ada Baker"], ["Pea soup", "Ben Cook"]];
    for (const [index, [title, cook]] of rows.entries()) {
      const record = { keyAttribute: "data-recipe-id", key: `recipe-${index + 1}` };
      const at = elements.length;
      elements.push({ tagName: "article", selector: `#card-${index + 1}`, parent: 0, attributes: { class: "card" }, context: { record } });
      elements.push({ tagName: "h3", selector: `#card-${index + 1} > h3`, text: title, name: title, parent: at, context: { record } });
      elements.push({ tagName: "p", selector: `#card-${index + 1} > p`, text: cook, parent: at, context: { record } });
      elements.push({ tagName: "button", selector: `#card-${index + 1} > button`, name: "Save", parent: at, context: { record } });
    }
    return { ok: true, payload: { result: { snapshot: { url: "https://recipes.test/cards", title: "Recipes", interactiveElements: elements } } } };
  };
  const boundary = createWebAutomationHostRuntime(seam([cards(), cards()]));
  const pass = { ...node, parameterValues: { selector: "#card-1 > button", element: { selector: "#card-1 > button", context: { record: { keyAttribute: "data-recipe-id", key: "recipe-1" } } } } };
  const before = await boundary.captureStateSnapshot!({ ...capture("before_action"), node: pass });
  const after = await boundary.captureStateSnapshot!({ ...capture("after_action"), node: pass });
  const recorded = await boundary.inspectStateDiff!({ before, after, node: pass, attemptId: "save.attempt.1" });
  const second = await boundary.inspectStateDiff!({ before, after, node: pass, attemptId: "save.attempt.1", inputs: { item: { title: "Pea soup", cook: "Ben Cook" } } });
  const own = await boundary.inspectStateDiff!({ before, after, node: { ...node, parameterValues: { selector: "#card-2 > button" } }, attemptId: "save.attempt.1" });
  assert.match(String((second.spot as JsonObject).item), /^i:[0-9a-f]{32}$/u);
  assert.notEqual((second.spot as JsonObject).item, (recorded.spot as JsonObject).item);
  assert.equal((second.spot as JsonObject).item, (own.spot as JsonObject).item);
});
