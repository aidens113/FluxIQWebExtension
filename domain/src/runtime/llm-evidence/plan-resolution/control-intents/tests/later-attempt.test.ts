// A later attempt's own act is the witness its repaired step assembles from (t1071, F3).
//
// Live run `run-mwyfc9uf-215bbd84` (bigbox, `--attempts 4`, no reseed): attempt 1 added a roll and clicked the
// header's cart link while it read "🛒 1 $3.97" (0018, 0020). Attempt 2 replayed the saved Flow, met the link as
// "🛒 2 $5.25" on the search page, clicked it by hand (0045, 0047) and kept that step. Its draft was refused at
// assembly, `web.handle.ambiguous` at the click (0062): the link now read the same on the search page and on the
// cart page, so the host's absolute target matched two retained sources and needed a witness of the act
// (`../absolute.ts`), and the store kept only the first act on each handle -- attempt 1's, as it read
// then -- so attempt 2's act witnessed nothing. Every attempt runs under one Flow id, so the store outlives it.
//
// Held here through the node runner, as the run went: the page markup is the scenario's (one header link, words that
// are the cart's count and total, a new document per load), and the act's parameters are assembled as the draft
// carries them, with no page named.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "../../..";
import { shownHandle } from "../../../page-view/tests/shown-page-lines";
import { sanitizeWebLlmSnapshotWithBindings } from "../../../sanitize";
import { createWebLlmExtractionHandles } from "../../../structure";
import { createWebLlmTargetPackets, resolveWebPlanNodeParameters } from "../..";

const SCOPE = { projectId: "project.later-attempt", flowId: "flow.later-attempt" };
const ORIGIN = "https://bigbox.test";
const SEARCH = `${ORIGIN}/search?q=paper+towels&sort=price_low`;
const CART = `${ORIGIN}/cart`;
const CLICK = webAutomationOutputNodeId("web.dom.click");
const CART_LINK = "header > nav > a.cart-link";
const ADD = "#results > li:nth-of-type(1) > button";

type Site = { page: "search" | "cart"; items: number; shown: number; document: number };

/** The header shows the cart as the document loaded it; an add counts in the next load (0018). */
function site(): { runtime: WebAutomationLlmEvidenceRuntime; state: Site; load: (page: Site["page"]) => void } {
  const state: Site = { page: "search", items: 1, shown: 1, document: 1 };
  const load = (page: Site["page"]): void => {
    state.page = page;
    state.shown = state.items;
    state.document += 1;
  };
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_session, command) => {
      if (command.actionType === "web.dom.click") {
        if (command.parameters.selector === ADD) state.items = 2;
        if (command.parameters.selector === CART_LINK) load("cart");
        return { status: "succeeded" };
      }
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const url = state.page === "search" ? SEARCH : CART;
      const total = state.shown === 1 ? "$3.97" : "$5.25";
      const words = `🛒 ${state.shown} ${total}`;
      const elements: JsonObject[] = [
        { tagName: "a", selector: "header > a.logo", visibleText: "ValueRidge", attributes: { href: `${ORIGIN}/` } },
        { tagName: "a", selector: CART_LINK, visibleText: words, accessibleName: `${state.shown} ${total}`, classNames: ["cart-link"], href: CART, attributes: { href: CART, class: "cart-link" } },
        ...(state.page === "search"
          ? [{ tagName: "button", selector: ADD, visibleText: "+ Add", classNames: ["add"], attributes: { class: "add" } }]
          : [{ tagName: "h1", selector: "main > h1", visibleText: "Cart" }])
      ];
      return { status: "succeeded", payload: { snapshot: {
        url, title: state.page, interactiveElements: elements,
        evidence: { navigation: { url, origin: ORIGIN, path: new URL(url).pathname, type: "navigate", timeOrigin: state.document, historyLength: 1, visibility: "visible" } }
      } } };
    }
  });
  return { runtime, state, load };
}

let calls = 0;
async function run(runtime: WebAutomationLlmEvidenceRuntime, node: string, parameters: JsonObject, callId = `call.${++calls}`) {
  return await runtime.executeTool({ ...SCOPE, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node, parameters, consequences: [] } });
}

/** The parameters a click on `handle` ran with on `page`, as a draft keeps them. */
async function ranWith(runtime: WebAutomationLlmEvidenceRuntime, handle: string, page: string): Promise<JsonObject> {
  const resolved = await runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: CLICK, parameters: { target: { handle } }, gatedByCaller: true, onPage: page });
  if (resolved.status !== "resolved") assert.fail(JSON.stringify(resolved));
  return resolved.parameters;
}

/** The draft's step assembled as Core assembles it: the act's own parameters, no page named. */
async function assemble(runtime: WebAutomationLlmEvidenceRuntime, parameters: JsonObject, handleReach?: "view_history") {
  return await runtime.resolvePlanNodeParameters({
    ...SCOPE, nodeDefinitionId: CLICK, parameters: structuredClone(parameters), declaredConsequences: [],
    permission: async () => ({ permitted: true as const }), handleReach
  });
}

test("attempt 2's own click on the header link assembles though the link reads alike on two pages", async () => {
  const { runtime, load } = site();
  // Attempt 1: the search page, the add, the cart link as the header still read it, the cart page.
  const first = await run(runtime, "web.output.dom-capture_snapshot", {});
  await run(runtime, CLICK, { target: { handle: shownHandle(first.evidence, "+ Add") } });
  const added = await run(runtime, "web.output.dom-capture_snapshot", {});
  const link1 = shownHandle(added.evidence, "1 $3.97");
  const parameters1 = await ranWith(runtime, link1, SEARCH);
  await run(runtime, CLICK, { target: { handle: link1 } });
  for (const handleReach of [undefined, "view_history"] as const) {
    const saved = await assemble(runtime, parameters1, handleReach);
    assert.notEqual(saved.status, "refused", `attempt 1's step (${handleReach ?? "current"}): ${JSON.stringify(saved)}`);
    // The build saw the link read "🛒 2 $5.25" on the cart page: its words are state, so the saved step keeps them as a
    // value and carries where the link leads (F1, `../../self-changing/state-words.ts`).
    if (saved.status !== "resolved") assert.fail(JSON.stringify(saved));
    const element = saved.parameters.element as JsonObject;
    assert.deepEqual([element.readsWords, element.href, element.visibleText], [true, "/cart", "🛒 1 $3.97"], JSON.stringify(element));
  }

  // Attempt 2: Core replays the Flow to the search page (a new document; the header now counts both), then the model
  // clicks the link by hand.
  load("search");
  const second = await run(runtime, "web.output.dom-capture_snapshot", {}, "initial.core.run_node");
  const link2 = shownHandle(second.evidence, "2 $5.25");
  const parameters2 = await ranWith(runtime, link2, SEARCH);
  assert.deepEqual([(parameters2.element as JsonObject).visibleText, (parameters2.element as JsonObject).readsWords], ["🛒 2 $5.25", true], JSON.stringify(parameters2));
  await run(runtime, CLICK, { target: { handle: link2 } });
  await run(runtime, "web.output.dom-capture_snapshot", {});
  for (const handleReach of [undefined, "view_history"] as const) {
    const saved = await assemble(runtime, parameters2, handleReach);
    assert.notEqual(saved.status, "refused", `attempt 2's step (${handleReach ?? "current"}): ${JSON.stringify(saved)}`);
    if (saved.status === "resolved") assert.deepEqual(saved.parameters, parameters2, "assembly never changes the act's parameters");
  }
});

test("an act witnesses the identity it ran with, its views' agreement, as well as its own capture", async () => {
  // The link on the search page took a passing class in the view the act was made from, so the act ran with the
  // views' agreement (`../../element-identity.ts`), which the cart page's link also matches exactly.
  const targets = createWebLlmTargetPackets();
  const stores = { targets, extractions: createWebLlmExtractionHandles() };
  const capture = (url: string, classes: string[], document: number) => sanitizeWebLlmSnapshotWithBindings({
    url, interactiveElements: [{ tagName: "a", selector: CART_LINK, visibleText: "🛒 2 $5.25", classNames: classes, href: CART, attributes: { href: CART, class: classes.join(" ") } }],
    evidence: { navigation: { url, origin: ORIGIN, path: new URL(url).pathname, type: "navigate", timeOrigin: document, historyLength: 1, visibility: "visible" } }
  });
  targets.remember(SCOPE, capture(SEARCH, ["cart-link"], 7));
  const before = capture(SEARCH, ["cart-link", "is-hovered"], 7);
  targets.remember(SCOPE, before);
  const ran = await resolveWebPlanNodeParameters({ ...SCOPE, nodeDefinitionId: CLICK, parameters: { target: { handle: "t1" } }, gatedByCaller: true, onPage: SEARCH }, stores);
  if (ran.status !== "resolved") assert.fail(JSON.stringify(ran));
  assert.deepEqual((ran.parameters.element as JsonObject).classNames, ["cart-link"], "the act runs with what the views agree on");
  const after = capture(CART, ["cart-link"], 8);
  targets.acted(SCOPE, "t1", before, after);
  targets.remember(SCOPE, after);
  for (const handleReach of [undefined, "view_history"] as const) {
    const saved = await resolveWebPlanNodeParameters({
      ...SCOPE, nodeDefinitionId: CLICK, parameters: structuredClone(ran.parameters), declaredConsequences: [], permission: async () => ({ permitted: true as const }), handleReach
    }, stores);
    assert.notEqual(saved.status, "refused", `${handleReach ?? "current"}: ${JSON.stringify(saved)}`);
  }
});
