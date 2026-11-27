// A step passed over as never arisen still owes where it went (`../reach-route.ts`,
// t1083), proven on bigbox `run-mwz29d50-c3a32a9c`'s attempt 2 with Core's own
// decision. s11 "Add to cart" was rightly left alone as already done, so the drawer
// an add opens never came and its "View cart" (s12) was not found. Until t1083 Core
// passed s12 over straight to s13, and the cart read ran on the product page. Now
// Core asks this host to reach the route s12's recorded effect went to, and the host
// presses the product page's header cart link, the one link there to the cart.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { decideAutomationStudioStateRoute } from "fluxiq/automation";
import { webAutomationRouteEffect } from "../../route-state";
import { webAutomationReachRouteEffect, webOwedRoute, type WebRouteReachDispatch } from "..";
import { BIGBOX_CART_PAGE, BIGBOX_PRODUCT_PAGE } from "./bigbox-pages";

/** s12's recorded effect as task memory kept it for step d10 (signed before t1083: no `from`, no `destination`). */
const VIEW_CART_EFFECT: JsonObject = {
  v: "web-effect.v1",
  added: ["01dae98c", "0e42696d", "2482e37a", "24938f56", "6c3589cb", "7a00f8df", "bcfdba09", "c5eb38da", "eb5e6149", "ebf5d181"],
  removed: ["069b17c9", "090b5119", "0c289034", "12de7428", "22e2b264", "2d333e29", "2e1f3d5f", "2e89dbd4", "472a0d6e", "756de015", "75dc6e14", "7a1add77", "8a724555", "9f18354c", "aa72f580", "b81f032a"],
  path: "53622792"
};
const HEADER_CART_LINK = "body > div > header > div > nav > a:nth-of-type(3)";
const CART = "http://127.0.0.1:52163/scenarios/bigbox-retail/cart";

type Sent = { outputId: string; payload: JsonObject };

/**
 * A browser that answers a page read with the page it stands on, moves to the cart on a
 * press of a link to it (or wherever `pressMoves` says), and to the address it is sent to.
 */
function browser(start: unknown, options: { pressMoves?: boolean; pages?: Record<string, unknown> } = {}): { dispatch: WebRouteReachDispatch; sent: Sent[] } {
  const sent: Sent[] = [];
  const pages: Record<string, unknown> = { [CART]: BIGBOX_CART_PAGE, ...options.pages };
  let page = start;
  const dispatch: WebRouteReachDispatch = async ({ outputId, payload }) => {
    sent.push({ outputId, payload });
    if (outputId === "web.dom.capture_snapshot") return { ok: true, status: "succeeded", payload: { result: { snapshot: page as JsonObject } } };
    if (outputId === "web.dom.click") {
      const pressed = (page as { interactiveElements: Array<{ selector: string; href?: string }> }).interactiveElements.find((element) => element.selector === payload.selector);
      if (options.pressMoves !== false && pressed?.href !== undefined) page = pages[new URL(pressed.href).origin + new URL(pressed.href).pathname] ?? page;
      return { ok: true, status: "succeeded" };
    }
    if (outputId === "web.browser.navigate") {
      page = pages[String(payload.url)] ?? page;
      return { ok: true, status: "succeeded" };
    }
    return { ok: false };
  };
  return { dispatch, sent };
}

/** Attempt 2's three nodes and the run so far, as Core holds them when s12 cannot run. */
function attempt2() {
  const node = "node.bootstrap.a0036f0c3f062adf.main";
  const add = { id: `${node}.s11`, definitionId: "web.output.dom-click", label: "Add to cart", parameterValues: { selector: "[data-testid=\"atc\"]" }, metadata: { declaredConsequences: ["modify_existing"] } };
  const viewCart = { id: `${node}.s12`, definitionId: "web.output.dom-click", label: "View cart", parameterValues: { selector: "body > aside > a" }, metadata: { declaredConsequences: [], routeSignatures: { effect: VIEW_CART_EFFECT } } };
  const read = { id: `${node}.s13`, definitionId: "web.output.dom-extract_list", parameterValues: { recordOutput: { datasetId: "step.cart_read2.v1" } } };
  const edge = (from: string, to: string) => ({ id: `${from}-${to}`, sourceNodeId: from, sourcePortId: "success", targetNodeId: to, targetPortId: "in" });
  const flow = { schemaVersion: "0.1" as const, flowId: "flow.34fbe190", ownerKind: "routine" as const, ownerId: "506ef250", name: "Cheapest towels", createdAt: 1, updatedAt: 1, metadata: { projectId: "506ef250" }, nodes: [add, viewCart, read], edges: [edge(add.id, viewCart.id), edge(viewCart.id, read.id)] };
  const ran = (id: string, extra: object) => ({ attemptId: `${id}.attempt.1`, nodeId: id, definitionId: "web.output.dom-click", startedAt: 1, finishedAt: 1, status: "succeeded" as const, route: "success", inputs: {}, outputs: {}, effects: [], ...extra });
  const notFound = ran(viewCart.id, { status: "failed" as const, route: "failed", failure: { category: "target_not_found" as const, code: "web.target.not_found", retryable: true, stage: "target_resolution" as const, effect: "unacted" as const } });
  return { flow, viewCart, read, attempts: [ran(add.id, { outputs: { skipped: "already_done" } }), notFound], notFound };
}

type DecisionInput = Parameters<typeof decideAutomationStudioStateRoute>[0];
const noGuard = { admit: () => ({ admitted: true }), reopen: () => true } as unknown as DecisionInput["guard"];
const click = { resolveActionEffect: () => ({ effectClass: "commit" as const, permissionConsequences: [] }) };

test("run-mwz29d50 attempt 2: Core reaches the cart through the product page's header link before the cart read", async () => {
  const { flow, viewCart, read, attempts, notFound } = attempt2();
  const { dispatch, sent } = browser(BIGBOX_PRODUCT_PAGE);
  const hostRuntime = { reachRouteEffect: (request: Parameters<typeof webAutomationReachRouteEffect>[0]) => webAutomationReachRouteEffect(request, dispatch) };
  const decision = await decideAutomationStudioStateRoute({ flow, node: viewCart, attempt: notFound, attempts, options: { ...click, hostRuntime }, guard: noGuard } as unknown as DecisionInput);
  assert.equal(decision.kind, "declared");
  assert.equal(decision.kind === "declared" && decision.reached, "pressed");
  assert.equal(decision.kind === "declared" && decision.edge.targetNodeId, read.id);
  assert.deepEqual(sent.map((entry) => entry.outputId), ["web.dom.capture_snapshot", "web.dom.click", "web.dom.capture_snapshot"]);
  assert.equal(sent[1]!.payload.selector, HEADER_CART_LINK, "the header's cart link, the one link on the page to the cart");
});

test("the recorded effect, signed before t1083, names the cart only by its path shape, which the header link's address has", () => {
  const route = webOwedRoute(VIEW_CART_EFFECT)!;
  assert.equal(route.destination, undefined);
  assert.equal(route.holds(CART), true);
  assert.equal(route.holds(`${CART}?coupon=1`), true, "a route is the address without its query");
  assert.equal(route.holds(BIGBOX_PRODUCT_PAGE.url), false);
});

test("a page already on the route goes on with nothing pressed", async () => {
  const { dispatch, sent } = browser(BIGBOX_CART_PAGE);
  assert.equal(await webAutomationReachRouteEffect({ node: { id: "s12", definitionId: "web.output.dom-click" }, effect: VIEW_CART_EFFECT, projectId: "p", flowId: "f" }, dispatch), "already_there");
  assert.deepEqual(sent.map((entry) => entry.outputId), ["web.dom.capture_snapshot"]);
});

test("an effect that moved to no other route owes nothing, and nothing is looked at", async () => {
  const { dispatch, sent } = browser(BIGBOX_PRODUCT_PAGE);
  const { path: _path, ...stayed } = VIEW_CART_EFFECT;
  assert.equal(await webAutomationReachRouteEffect({ node: { id: "close", definitionId: "web.output.dom-click" }, effect: stayed, projectId: "p", flowId: "f" }, dispatch), "stays");
  assert.equal(await webAutomationReachRouteEffect({ node: { id: "close", definitionId: "web.output.dom-click" }, effect: { ...VIEW_CART_EFFECT, v: "web-effect.v0" }, projectId: "p", flowId: "f" }, dispatch), "stays");
  assert.equal(sent.length, 0);
});

/** The product page with no link to the cart left on it. */
const NO_CART_LINK = { ...BIGBOX_PRODUCT_PAGE, interactiveElements: BIGBOX_PRODUCT_PAGE.interactiveElements.filter((element) => element.selector !== HEADER_CART_LINK) };

test("with no link to the route, an effect that kept its destination goes there; one that did not is unreached", async () => {
  const withDestination = { ...VIEW_CART_EFFECT, destination: "/scenarios/bigbox-retail/cart" };
  const went = browser(NO_CART_LINK);
  assert.equal(await webAutomationReachRouteEffect({ node: { id: "s12", definitionId: "web.output.dom-click" }, effect: withDestination, projectId: "p", flowId: "f" }, went.dispatch), "went");
  assert.deepEqual(went.sent.filter((entry) => entry.outputId === "web.browser.navigate").map((entry) => entry.payload.url), [CART], "resolved against the page's own origin, which a later run's Lab port changes");
  const unreached = browser(NO_CART_LINK);
  assert.equal(await webAutomationReachRouteEffect({ node: { id: "s12", definitionId: "web.output.dom-click" }, effect: VIEW_CART_EFFECT, projectId: "p", flowId: "f" }, unreached.dispatch), "unreached");
  assert.equal(unreached.sent.some((entry) => entry.outputId === "web.dom.click" || entry.outputId === "web.browser.navigate"), false);
});

test("a press that did not bring the page there falls back to the destination, and says so", async () => {
  const withDestination = { ...VIEW_CART_EFFECT, destination: "/scenarios/bigbox-retail/cart" };
  const { dispatch, sent } = browser(BIGBOX_PRODUCT_PAGE, { pressMoves: false });
  assert.equal(await webAutomationReachRouteEffect({ node: { id: "s12", definitionId: "web.output.dom-click" }, effect: withDestination, projectId: "p", flowId: "f" }, dispatch), "went");
  assert.deepEqual(sent.map((entry) => entry.outputId), ["web.dom.capture_snapshot", "web.dom.click", "web.dom.capture_snapshot", "web.browser.navigate", "web.dom.capture_snapshot"]);
});

test("a page that cannot be read is unreached", async () => {
  const dispatch: WebRouteReachDispatch = async () => ({ ok: false });
  assert.equal(await webAutomationReachRouteEffect({ node: { id: "s12", definitionId: "web.output.dom-click" }, effect: VIEW_CART_EFFECT, projectId: "p", flowId: "f" }, dispatch), "unreached");
});

test("the header's link is pressed before the same link in a drawer that covers the page", async () => {
  const drawer = { tagName: "aside", selector: "body > aside", accessibleName: "Customers also bought", isVisibleOnViewport: true, context: { landmark: "complementary" }, covers: ["main"] };
  const drawerLink = { tagName: "a", selector: "body > aside > a", href: CART, accessibleName: "View cart", implicitRole: "link", isVisibleOnViewport: true, context: { landmark: "complementary" }, attributes: { href: "/scenarios/bigbox-retail/cart" } };
  // The drawer's link first in document order, so only the ranking puts the header's first.
  const opened = { ...BIGBOX_PRODUCT_PAGE, interactiveElements: [drawer, drawerLink, ...BIGBOX_PRODUCT_PAGE.interactiveElements] };
  const { dispatch, sent } = browser(opened);
  assert.equal(await webAutomationReachRouteEffect({ node: { id: "s12", definitionId: "web.output.dom-click" }, effect: VIEW_CART_EFFECT, projectId: "p", flowId: "f" }, dispatch), "pressed");
  assert.equal(sent.find((entry) => entry.outputId === "web.dom.click")?.payload.selector, HEADER_CART_LINK);
});

test("an effect signed before t1083 presses nothing when links of its shape go to different paths", async () => {
  // A route of the product-page shape: the page offers two product links that share it.
  const toProduct = webAutomationRouteEffect(
    { page: { location: CART, path: "/scenarios/bigbox-retail/cart", controls: "Check out" } },
    { page: { location: BIGBOX_PRODUCT_PAGE.url, path: new URL(BIGBOX_PRODUCT_PAGE.url).pathname, controls: "Add to cart | Pickup | Delivery" } }
  );
  const { destination: _destination, from: _from, ...legacy } = toProduct;
  const { dispatch, sent } = browser(BIGBOX_CART_PAGE);
  assert.equal(await webAutomationReachRouteEffect({ node: { id: "open", definitionId: "web.output.dom-click" }, effect: legacy, projectId: "p", flowId: "f" }, dispatch), "unreached");
  assert.equal(sent.some((entry) => entry.outputId === "web.dom.click"), false);
  // With its destination it is no guess: the cart's own line for that product goes there.
  const exact = browser(BIGBOX_CART_PAGE, { pages: { [BIGBOX_PRODUCT_PAGE.url]: BIGBOX_PRODUCT_PAGE } });
  assert.equal(await webAutomationReachRouteEffect({ node: { id: "open", definitionId: "web.output.dom-click" }, effect: toProduct, projectId: "p", flowId: "f" }, exact.dispatch), "pressed");
  assert.equal(exact.sent.find((entry) => entry.outputId === "web.dom.click")?.payload.selector, "main > div:nth-of-type(1) > div > section > div:nth-of-type(3) > div > a");
});
