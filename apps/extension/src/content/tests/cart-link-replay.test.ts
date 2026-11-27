// The header's cart link, saved in one attempt and replayed in the next (t1071, F1).
//
// Live run `run-mwyfc9uf-215bbd84` (bigbox, `--attempts 4`, no reseed). Attempt 1 added a roll and clicked the
// header's cart link while it read "🛒 1 $3.97" (0018, 0020); the cart page it opened read "🛒 2 $5.25". Attempt 2
// replayed the saved Flow and met the same link, same handle and address, as "🛒 2 $5.25" (0045): playback refused it
// four times, `web.target.not_found` (0040-0043), because the step's words were the only thing it carried that says
// which control it is, and they are the cart's count and total.
//
// Each row goes the whole way the saved step goes: the pages described with the content script's own rules, the
// domain's evidence runtime exploring them as attempt 1 did (look, add, look, click the link), the act's parameters
// assembled into the saved step as Core assembles a draft, the gateway mapping into the command, and this resolver
// against the page the next attempt meets. The markup is the scenario's header
// (`apps/scenario-lab/src/scenarios/bigbox-retail/shell/shell.ts`): one cart link of three spans, and a closed mini
// cart holding a "View cart" link to the same place.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { normalizeWebElementTarget, createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, webLlmShownPageText } from "@fluxiq-web-extension/domain";
import type { JsonObject } from "fluxiq/core";
import { outputTargetFromPayload, webAutomationActionFromGatewayCommand, webAutomationOutputNodeId } from "@fluxiq-web-extension/domain/client";
import { resolveTarget } from "../action-runtime";
import { accessibleNameFor, boundedText, implicitRole } from "../identity";
import { selectorFor } from "../selector";
import type { BrowserActionCommand } from "../types";
import { el, installStubDocument, stubDocument, type StubElement } from "./stub-dom";

const ORIGIN = "http://127.0.0.1:4100";
const SEARCH = `${ORIGIN}/scenarios/bigbox-retail/search?q=paper+towels&sort=price_low`;
const CART = `${ORIGIN}/scenarios/bigbox-retail/cart`;
const CART_PATH = "/scenarios/bigbox-retail/cart";
const SCOPE = { projectId: "project.cart", flowId: "flow.cart" };
const CLICK = webAutomationOutputNodeId("web.dom.click");

type Shop = {
  page: "search" | "cart";
  count: number;
  total: string;
  /** Where the header link leads; the cart, as the scenario has it, when absent. */
  linkTo?: string;
  /** The mini cart is open, so its "View cart" is shown beside the header link. */
  miniCartOpen?: boolean;
};
type Installed = { cartLink: Element; add: Element | undefined; controls: Element[]; url: string };

/** The page for `shop`, installed with the globals the content script reads. */
function install(t: TestContext, shop: Shop): Installed {
  const document = stubDocument();
  const cartLink = el("a", { class: "cart", href: shop.linkTo ?? CART_PATH },
    el("span", { "aria-hidden": "true" }, "🛒"), el("span", { class: "badge" }, String(shop.count)), el("span", { class: "total" }, shop.total));
  const viewCart = el("a", { href: CART_PATH }, "View cart");
  const add = shop.page === "search" ? el("button", { type: "button", class: "add" }, "+ Add") : undefined;
  const reorder = el("a", { href: "#" }, "Reorder My Items");
  const main: StubElement = shop.page === "search"
    ? el("main", {}, el("ul", {}, el("li", {}, el("a", { href: "/scenarios/bigbox-retail/ip/towels" }, "Paper Towels, 1 Roll"), add!)))
    : el("main", {}, el("h1", {}, "Cart"));
  document.append(el("html", {}, el("body", {},
    el("header", {}, el("div", {},
      el("a", { class: "logo", href: "/scenarios/bigbox-retail/" }, "ValueRidge"),
      el("nav", {}, reorder, cartLink),
      el("div", shop.miniCartOpen ? { class: "mini" } : { class: "mini", hidden: "" }, el("strong", {}, "Your cart"), viewCart))),
    main)));
  installStubDocument(t, document);
  const controls = [cartLink, viewCart, reorder, ...(add ? [add] : []), ...main.querySelectorAll("a, h1")] as unknown as Element[];
  return { cartLink: cartLink as unknown as Element, add: add as unknown as Element | undefined, controls, url: shop.page === "search" ? SEARCH : CART };
}

/** An element as `describe-element.ts` puts it in a snapshot: its address, words, name, role, and a link's absolute address. */
function described(element: Element, url: string): JsonObject {
  const text = boundedText(element.textContent, 500);
  const name = accessibleNameFor(element);
  const role = implicitRole(element);
  const href = element.getAttribute("href");
  return {
    tagName: element.tagName.toLowerCase(),
    selector: selectorFor(element),
    ...(text ? { visibleText: text, text } : {}),
    ...(name ? { accessibleName: name } : {}),
    ...(role ? { implicitRole: role } : {}),
    ...(element.getAttribute("class") ? { classNames: element.getAttribute("class")!.split(" ") } : {}),
    ...(href ? { href: new URL(href, url).href, attributes: { href } } : {})
  };
}

/** The saved step, as attempt 1 explored and its draft was assembled; and the act's own parameters before assembly. */
async function attemptOne(t: TestContext): Promise<{ saved: BrowserActionCommand; asActed: BrowserActionCommand }> {
  let page = install(t, { page: "search", count: 1, total: "$3.97" });
  let document = 1;
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_session, command) => {
      if (command.actionType === "web.dom.click" && command.parameters.selector === selectorFor(page.cartLink)) {
        page = install(t, { page: "cart", count: 2, total: "$5.25" });
        document += 1;
      }
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      return { status: "succeeded", payload: { snapshot: {
        url: page.url, title: "ValueRidge", interactiveElements: page.controls.map((control) => described(control, page.url)),
        evidence: { navigation: { url: page.url, origin: ORIGIN, path: new URL(page.url).pathname, type: "navigate", timeOrigin: document, historyLength: 1, visibility: "visible" } }
      } } };
    }
  });
  let calls = 0;
  const run = async (node: string, parameters: JsonObject) => await runtime.executeTool({ ...SCOPE, callId: `call.${++calls}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node, parameters, consequences: [] } });
  const handleOf = (result: { evidence: unknown }, words: RegExp): string => {
    const view = webLlmShownPageText(result.evidence) ?? "";
    const handle = view.split("\n").find((line) => words.test(line))?.split(" ")[0];
    if (handle === undefined || !handle.startsWith("t")) assert.fail(`no line matches ${words}: ${view}`);
    return handle;
  };
  const look = webAutomationOutputNodeId("web.dom.capture_snapshot");
  const first = await run(look, {});
  await run(CLICK, { target: { handle: handleOf(first, /"\+ Add"/u) } });
  const added = await run(look, {});
  const link = handleOf(added, /\$3\.97/u);
  const acted = await runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: CLICK, parameters: { target: { handle: link } }, gatedByCaller: true, onPage: SEARCH });
  if (acted.status !== "resolved") assert.fail(JSON.stringify(acted));
  await run(CLICK, { target: { handle: link } });
  await run(look, {});
  const assembled = await runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: CLICK, parameters: structuredClone(acted.parameters), declaredConsequences: [], permission: async () => ({ permitted: true as const }) });
  if (assembled.status !== "resolved") assert.fail(JSON.stringify(assembled));
  return { saved: command(assembled.parameters), asActed: command(acted.parameters) };
}

/** The gateway command a saved step's parameters dispatch as. */
function command(parameters: JsonObject): BrowserActionCommand {
  const prepared: JsonObject = Object.assign({}, parameters);
  const target = normalizeWebElementTarget(parameters, { source: "runtime" });
  if (target) prepared.target = target as unknown as JsonObject;
  const dispatched = webAutomationActionFromGatewayCommand({ commandId: "cmd-10", actionType: "web.dom.click", parameters: prepared, target: outputTargetFromPayload(prepared) ?? {} });
  assert.equal("status" in dispatched, false, "the command is dispatched");
  return dispatched as unknown as BrowserActionCommand;
}

function failureCode(action: () => unknown): string | undefined {
  try {
    action();
  } catch (error) {
    return (error as { failure?: { code?: string } }).failure?.code;
  }
  return undefined;
}

test("the saved step keeps the link's words as a value and carries where it leads", async (t) => {
  const { saved, asActed } = await attemptOne(t);
  // The hand-built page names a link by all its text; the packet keeps it once, as the name.
  assert.equal(saved.element?.accessibleName, "🛒1$3.97", "the words as the step was saved by");
  assert.equal((saved.element as { readsWords?: boolean }).readsWords, true);
  assert.equal((saved.element as { href?: string }).href, CART_PATH);
  assert.equal((asActed.element as { readsWords?: boolean }).readsWords, undefined, "at the act the build had seen one wording only");
});

test("attempt 2's page, the cart counted: step 10 resolves to the header link", async (t) => {
  const { saved } = await attemptOne(t);
  const page = install(t, { page: "search", count: 2, total: "$5.25" });
  const resolved = resolveTarget(saved);
  assert.equal(resolved.element, page.cartLink);
  assert.ok((resolved.resolution.confidence ?? 0) > 0, "accepted with Core's measurement of what stays");
});

test("the step as it stood before the build marked its words is still refused on that page", async (t) => {
  const { asActed } = await attemptOne(t);
  install(t, { page: "search", count: 2, total: "$5.25" });
  assert.equal(failureCode(() => resolveTarget(asActed)), "web.target.not_found");
});

test("what stays must confirm it: another destination, or a second visible link there, is refused", async (t) => {
  await t.test("the same words and place leading elsewhere", async (inner) => {
    const { saved } = await attemptOne(inner);
    install(inner, { page: "search", count: 1, total: "$3.97", linkTo: "/scenarios/bigbox-retail/orders" });
    assert.equal(failureCode(() => resolveTarget(saved)), "web.target.not_found");
  });
  await t.test("the mini cart open, its View cart leading to the same place", async (inner) => {
    const { saved } = await attemptOne(inner);
    install(inner, { page: "search", count: 2, total: "$5.25", miniCartOpen: true });
    // The header link alone is refused at Level 1, and Level 2 weighs the two links to the cart level: a tie.
    assert.equal(failureCode(() => resolveTarget(saved)), "web.target.ambiguous");
  });
});
