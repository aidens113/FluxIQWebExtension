// The host runtime boundary: state refs on web attempts, and nothing else.
//
// The proofs are that a web node's attempt gets a sanitized snapshot
// in both shapes a web node reaches the boundary: a web output node, and a
// recorded action, which Core runs as `builtin.policy.action` naming its web
// output in `parameterValues.outputId`; that a node which never touches the
// page is declined rather than costing a gateway round trip; that a diff with a
// side missing is declined; and that the diff says what moved without restating
// what the page says.

import assert from "node:assert/strict";
import test from "node:test";
import type { OutputDispatchResult } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../output-nodes";
import {
  createWebAutomationHostRuntime,
  type WebAutomationHostRuntimeBoundary,
  type WebAutomationHostRuntimeGateway
} from "../host-runtime";
import { compareWebAutomationRouteSignatures, webAutomationRouteEffect, webAutomationRouteEffectHolds, webAutomationRouteSignature } from "../route-state";
import { WEB_STATE_DIFF_SCHEMA_VERSION } from "../state-diff";

const CLICK_NODE_ID = webAutomationOutputNodeId("web.dom.click");
/** Core's node definition for a recorded action; its web output is `parameterValues.outputId`. */
const POLICY_ACTION_ID = "builtin.policy.action";

type DiffSides = Pick<Parameters<NonNullable<WebAutomationHostRuntimeBoundary["inspectStateDiff"]>>[0], "before" | "after">;

function pageSnapshot(url: string, selectors: string[], extra: JsonObject = {}): JsonObject {
  return {
    url,
    title: "Checkout",
    ...extra,
    interactiveElements: selectors.map((selector) => ({ tagName: "button", selector, name: selector.replace(/[#.]/gu, "") }))
  };
}

function gateway(answers: Array<Partial<OutputDispatchResult<JsonObject>>>): { gateway: WebAutomationHostRuntimeGateway; calls: Array<{ outputId: string; metadata: JsonObject; timeoutMs?: number }> } {
  const calls: Array<{ outputId: string; metadata: JsonObject; timeoutMs?: number }> = [];
  return {
    calls,
    gateway: {
      dispatch: async (request) => {
        calls.push({ outputId: request.outputId, metadata: request.metadata, ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}) });
        const answer = answers[calls.length - 1] ?? { ok: false, error: "no answer" };
        return { outputId: request.outputId, ok: false, ...answer } as OutputDispatchResult<JsonObject>;
      }
    }
  };
}

function captureInput(definitionId: string, point: "before_action" | "after_action" = "before_action", parameterValues: JsonObject = {}) {
  return { node: { id: "node.1", definitionId, parameterValues }, attemptId: "node.1.attempt.1", inputs: {}, point } as const;
}

test("a web attempt gets a sanitized state ref sourced from web.dom.capture_snapshot", async () => {
  const snapshot = pageSnapshot("https://shop.test/cart?token=leaked-token", ["#pay"]);
  // A card field, marked as one: the sensitivity rule drops it whole. A plain
  // text field's own value is page state, and travels (t200).
  (snapshot.interactiveElements as JsonObject[]).push({ tagName: "input", selector: "#card", inputType: "text", value: "4111111111111111", attributes: { autocomplete: "cc-number" } });
  (snapshot.interactiveElements as JsonObject[]).push({ tagName: "input", selector: "#note", inputType: "text", value: "Leave at the door" });
  const { gateway: seam, calls } = gateway([{ ok: true, status: "succeeded", payload: { status: "succeeded", result: { snapshot } } }]);
  const boundary = createWebAutomationHostRuntime(seam);
  const ref = await boundary.captureStateSnapshot!(captureInput(CLICK_NODE_ID));

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.outputId, "web.dom.capture_snapshot");
  assert.equal(calls[0]?.timeoutMs, 5_000);
  assert.equal(calls[0]?.metadata.point, "before_action");
  assert.equal(calls[0]?.metadata.attemptId, "node.1.attempt.1");
  assert.equal(ref.stateSnapshotId, "web.state.1");
  assert.equal(ref.stateRef, "web.state.1@node.1.attempt.1:before_action");
  assert.equal(typeof ref.capturedAt, "number");
  // The page as the model reads every page (t223): Core hands this summary to a
  // recovery model as `core.state_snapshot`, so it carries no element objects.
  assert.equal(ref.summary?.schemaVersion, "web-llm-page.v3");
  assert.equal(typeof ref.summary?.page, "string");
  assert.doesNotMatch(JSON.stringify(ref.summary), /"elements"|"box"|"attributes"|"selector"/u);
  assert.equal(ref.summary?.location, "https://shop.test/cart?token=(withheld)");
  // The sanitized packet's own rules apply, which is the point of reusing it:
  // a secret query value never travels and neither does a secret control's value.
  assert.doesNotMatch(JSON.stringify(ref.summary), /leaked-token|4111111111111111|cc-number/u);
  assert.match(JSON.stringify(ref.summary), /Leave at the door/u);
});

// Core reads `from` off a node's first attempt so a re-author's rerun of that
// node can put the page back where it started (t194 cause C-D, live run
// `run-murwcmx2-a1c6edf7`: a rerun of the Flow's list read ran on results page 5).
// It is the reset token a step's `replay.from` is: `{ location }`, navigated to
// as written, so it is the page's real address -- never a screened one, whose
// "(withheld)" would not reach the page -- and it is absent when the address
// holds anything the packet withholds, so it never carries a secret.
test("a state ref carries the page's own address as the token a reset navigates to", async () => {
  const location = "https://shop.test/s?k=wireless+earbuds&page=1#results";
  const { gateway: seam } = gateway([{ ok: true, status: "succeeded", payload: { status: "succeeded", result: { snapshot: pageSnapshot(location, ["#next"]) } } }]);
  const ref = await createWebAutomationHostRuntime(seam).captureStateSnapshot!(captureInput(CLICK_NODE_ID));

  assert.deepEqual(ref.from, { location });
  assert.equal(ref.summary?.location, location);
});

test("a state ref carries no reset token when the page's address holds something withheld", async () => {
  for (const url of ["https://shop.test/cart?token=leaked-token", "https://shop.test/account#access_token=abc", "https://user:pass@shop.test/"]) {
    const { gateway: seam } = gateway([{ ok: true, status: "succeeded", payload: { status: "succeeded", result: { snapshot: pageSnapshot(url, ["#pay"]) } } }]);
    const ref = await Promise.resolve(createWebAutomationHostRuntime(seam).captureStateSnapshot!(captureInput(CLICK_NODE_ID))).catch(() => undefined);
    assert.equal(ref?.from, undefined, url);
    assert.doesNotMatch(JSON.stringify(ref ?? {}), /leaked-token|access_token=abc|user:pass/u, url);
  }
});

test("a recorded action, Core's policy node naming web.dom.click, gets a state ref from web.dom.capture_snapshot", async () => {
  const payload = { status: "succeeded", result: { snapshot: pageSnapshot("https://shop.test/cart", ["#pay"]) } };
  const { gateway: seam, calls } = gateway([{ ok: true, status: "succeeded", payload }]);
  const boundary = createWebAutomationHostRuntime(seam);
  const ref = await boundary.captureStateSnapshot!(captureInput(POLICY_ACTION_ID, "before_action", { outputId: "web.dom.click", selector: "#pay" }));

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.outputId, "web.dom.capture_snapshot");
  assert.equal(calls[0]?.timeoutMs, 5_000);
  assert.equal(ref.stateRef, "web.state.1@node.1.attempt.1:before_action");
  assert.equal(ref.summary?.schemaVersion, "web-llm-page.v3");
  assert.equal(typeof ref.summary?.truncated, "boolean");
});

test("a policy node naming no web output, or a web output on another node, is declined without a gateway round trip", async () => {
  const payload = { status: "succeeded", result: { snapshot: pageSnapshot("https://shop.test/cart", ["#pay"]) } };
  const { gateway: seam, calls } = gateway(Array.from({ length: 6 }, () => ({ ok: true, status: "succeeded", payload })));
  const boundary = createWebAutomationHostRuntime(seam);
  const declined = [
    captureInput(POLICY_ACTION_ID, "before_action", { outputId: "email.send" }),
    // The web output node's id is not an output id.
    captureInput(POLICY_ACTION_ID, "before_action", { outputId: CLICK_NODE_ID }),
    captureInput(POLICY_ACTION_ID, "before_action", { outputId: 7 }),
    captureInput(POLICY_ACTION_ID),
    { ...captureInput(POLICY_ACTION_ID), node: { id: "node.1", definitionId: POLICY_ACTION_ID } },
    captureInput("builtin.code.run", "before_action", { outputId: "web.dom.click" })
  ];
  for (const input of declined) {
    await assert.rejects(async () => boundary.captureStateSnapshot!(input), /does not act on a page/u);
  }
  assert.equal(calls.length, 0);
});

test("a diff with a side missing is declined, so no diff claims every element appeared or left", async () => {
  const boundary = createWebAutomationHostRuntime(gateway([]).gateway);
  const summary = { schemaVersion: "web-llm-evidence.v2", location: "https://shop.test/cart", elements: [{ selector: "#pay" }] };
  const before = { stateSnapshotId: "web.state.1", stateRef: "web.state.1@a:before_action", capturedAt: 1, summary };
  const after = { stateSnapshotId: "web.state.2", stateRef: "web.state.2@a:after_action", capturedAt: 2, summary };
  const diff = async (sides: DiffSides) => boundary.inspectStateDiff!({ ...sides, node: { id: "node.1", definitionId: POLICY_ACTION_ID }, attemptId: "a" });
  const oneSided: DiffSides[] = [
    { before },
    { after },
    // A ref that came back without a summary is a missing snapshot too.
    { before, after: { stateSnapshotId: after.stateSnapshotId, stateRef: after.stateRef, capturedAt: after.capturedAt } }
  ];
  for (const sides of oneSided) {
    await assert.rejects(() => diff(sides), /snapshot on both sides/u);
  }
  const both = await diff({ before, after });
  assert.equal(both.schemaVersion, WEB_STATE_DIFF_SCHEMA_VERSION);
  assert.equal(both.removedCount, 0);
});

test("two summaries the boundary captured diff into the lines that came and went", async () => {
  const before = { status: "succeeded", result: { snapshot: pageSnapshot("https://shop.test/cart", ["#pay", "#edit"]) } };
  const after = { status: "succeeded", result: { snapshot: pageSnapshot("https://shop.test/thanks", ["#edit", "#receipt"]) } };
  const { gateway: seam } = gateway([{ ok: true, status: "succeeded", payload: before }, { ok: true, status: "succeeded", payload: after }]);
  const boundary = createWebAutomationHostRuntime(seam);
  const was = await boundary.captureStateSnapshot!(captureInput(CLICK_NODE_ID));
  const now = await boundary.captureStateSnapshot!(captureInput(CLICK_NODE_ID, "after_action"));
  const diff = await boundary.inspectStateDiff!({ before: was, after: now, node: { id: "node.1", definitionId: CLICK_NODE_ID }, attemptId: "a" });
  assert.equal(diff.locationChanged, true);
  assert.equal(diff.added, "button \"receipt\"");
  assert.equal(diff.removed, "button \"pay\"");
  assert.doesNotMatch(JSON.stringify(diff), /"addedElements"|"removedElements"|"tag"/u);
});

// Run `run-muw5zv4m-52d83027`: an address rewritten in place read as a page
// move. The summary carries the document's identity (`performance.timeOrigin`)
// beside the view, never in the view text a model reads, so the diff can tell a
// rewritten address from a new document.
test("a summary carries the document's identity beside the view, never in it, and the diff reads it", async () => {
  const origin = 1_759_000_000_123.4;
  const navigation = (url: string, timeOrigin: unknown): JsonObject => ({ evidence: { navigation: { url, origin: "https://shop.test", path: "/p", historyLength: 2, visibility: "visible", timeOrigin } } as unknown as JsonObject });
  const before = { status: "succeeded", result: { snapshot: pageSnapshot("https://shop.test/p?size=6", ["#six"], navigation("https://shop.test/p?size=6", origin)) } };
  const after = { status: "succeeded", result: { snapshot: pageSnapshot("https://shop.test/p?size=12", ["#six", "#twelve"], navigation("https://shop.test/p?size=12", origin)) } };
  const unusable = { status: "succeeded", result: { snapshot: pageSnapshot("https://shop.test/p?size=12", ["#six"], navigation("https://shop.test/p?size=12", "1759000000123.4")) } };
  const { gateway: seam } = gateway([{ ok: true, status: "succeeded", payload: before }, { ok: true, status: "succeeded", payload: after }, { ok: true, status: "succeeded", payload: unusable }]);
  const boundary = createWebAutomationHostRuntime(seam);
  const was = await boundary.captureStateSnapshot!(captureInput(CLICK_NODE_ID));
  const now = await boundary.captureStateSnapshot!(captureInput(CLICK_NODE_ID, "after_action"));
  const odd = await boundary.captureStateSnapshot!(captureInput(CLICK_NODE_ID, "after_action"));

  assert.equal(was.summary?.documentTimeOrigin, origin);
  assert.doesNotMatch(String(was.summary?.page), /1759000000123/u);
  // Only a finite number is an identity.
  assert.equal(odd.summary?.documentTimeOrigin, undefined);
  const diff = await boundary.inspectStateDiff!({ before: was, after: now, node: { id: "node.1", definitionId: CLICK_NODE_ID }, attemptId: "a" });
  assert.equal(diff.locationChanged, true);
  assert.equal(diff.documentChanged, false);
  assert.equal(diff.added, "button \"twelve\"");
});

test("each capture gets its own id, so a retry does not reuse the previous attempt's ref", async () => {
  const payload = { status: "succeeded", result: { snapshot: pageSnapshot("https://shop.test/cart", ["#pay"]) } };
  const { gateway: seam } = gateway([{ ok: true, status: "succeeded", payload }, { ok: true, status: "succeeded", payload }]);
  const boundary = createWebAutomationHostRuntime(seam);
  const first = await boundary.captureStateSnapshot!(captureInput(CLICK_NODE_ID));
  const second = await boundary.captureStateSnapshot!(captureInput(CLICK_NODE_ID, "after_action"));
  assert.notEqual(first.stateSnapshotId, second.stateSnapshotId);
  assert.notEqual(first.stateRef, second.stateRef);
});

test("a node that never touches the page is declined without a gateway round trip", async () => {
  const { gateway: seam, calls } = gateway([]);
  const boundary = createWebAutomationHostRuntime(seam);
  await assert.rejects(
    () => Promise.resolve(boundary.captureStateSnapshot!(captureInput("builtin.llm.generate"))),
    /does not act on a page/u
  );
  assert.equal(calls.length, 0);
});

test("a snapshot that never arrived produces no ref rather than a ref pointing at nothing", async () => {
  const missingClient = createWebAutomationHostRuntime(gateway([{ ok: false, error: "A single paired web-automation client must be selected." }]).gateway);
  await assert.rejects(() => Promise.resolve(missingClient.captureStateSnapshot!(captureInput(CLICK_NODE_ID))), /paired web-automation client/u);

  const emptyAnswer = createWebAutomationHostRuntime(gateway([{ ok: true, status: "succeeded", payload: { status: "succeeded" } }]).gateway);
  await assert.rejects(() => Promise.resolve(emptyAnswer.captureStateSnapshot!(captureInput(CLICK_NODE_ID))));
});

// `action-dispatch` is what Core asks of a host before a runtime repair that
// re-points an acting step may run; without it every executed target override
// was refused at preflight, in the Lab and the panel alike.
test("the boundary declares what it can answer, including action dispatch, the expectation seam and fact evaluation", () => {
  const boundary = createWebAutomationHostRuntime(gateway([]).gateway);
  assert.deepEqual([...boundary.capabilities], ["action-dispatch", "state-snapshot", "state-diff", "expectation-evaluation", "fact-evaluation", "route-state"]);
  assert.equal(typeof boundary.expectationEvaluator, "function");
  assert.equal(typeof boundary.factEvaluator, "function");
  assert.equal(typeof boundary.inspectStateDiff, "function");
});

test("the route state a Router tests is the sanitized packet projected: location, dialog and control names, never a value or a secret", async () => {
  const snapshot = pageSnapshot("https://shop.test/queue?token=leaked-token", ["#got-it"], {
    title: "Queue · Cadence",
    evidence: { dialogs: { open: [{ role: "dialog", label: "What's new in Cadence", modal: true }] } }
  });
  // A card field, marked as one: the sensitivity rule drops it whole. A plain
  // text field's own value is page state, and travels (t200).
  (snapshot.interactiveElements as JsonObject[]).push({ tagName: "input", selector: "#card", inputType: "text", value: "4111111111111111", attributes: { autocomplete: "cc-number" } });
  (snapshot.interactiveElements as JsonObject[]).push({ tagName: "input", selector: "#note", inputType: "text", value: "Leave at the door" });
  const { gateway: seam, calls } = gateway([{ ok: true, status: "succeeded", payload: { status: "succeeded", result: { snapshot } } }]);
  const boundary = createWebAutomationHostRuntime(seam);
  const state = await boundary.observeRouteState!({ projectId: "project.one", flowId: "flow.one" });
  assert.equal(calls[0]?.outputId, "web.dom.capture_snapshot");
  assert.equal(calls[0]?.timeoutMs, 5_000);
  const page = (state as { page: Record<string, unknown> }).page;
  assert.equal(page.path, "/queue");
  assert.equal(page.location, "https://shop.test/queue?token=(withheld)");
  assert.equal(page.dialog, "What's new in Cadence");
  assert.equal(typeof page.controls, "string");
  assert.doesNotMatch(JSON.stringify(state), /leaked-token|4111111111111111|#got-it|#card/u);
  assert.deepEqual(boundary.routeStatePaths?.map((entry) => entry.path), ["state.page.path", "state.page.location", "state.page.title", "state.page.dialog", "state.page.blockedBy", "state.page.controls"]);
});

// t243: Core records a signature of each node's pre- and post-state and asks
// the host whether a recorded one is the page observed now.
test("the boundary signs a route state and compares two signatures with the route-state functions", () => {
  const boundary = createWebAutomationHostRuntime(gateway([]).gateway);
  assert.equal(typeof boundary.signRouteState, "function");
  assert.equal(typeof boundary.compareRouteSignatures, "function");
  const cart: JsonObject = { page: { path: "/cart", controls: "Proceed to checkout | Remove item" } };
  const popup: JsonObject = { page: { path: "/cart", dialog: "Join our newsletter", controls: "Proceed to checkout | Remove item" } };
  assert.deepEqual(boundary.signRouteState!(cart), webAutomationRouteSignature(cart));
  const recorded = boundary.signRouteState!(cart);
  const observed = boundary.signRouteState!(popup);
  assert.deepEqual(boundary.compareRouteSignatures!(recorded, recorded), compareWebAutomationRouteSignatures(recorded, recorded));
  assert.deepEqual(boundary.compareRouteSignatures!(recorded, observed), compareWebAutomationRouteSignatures(recorded, observed));
  assert.equal(boundary.compareRouteSignatures!(recorded, recorded).matches, true);
  assert.equal(boundary.compareRouteSignatures!(recorded, observed).matches, false);
});

// t243: Core records the effect of each node's step and asks the host whether
// it is already on the page when the step cannot run.
test("the boundary signs a step's effect and judges it with the route-state functions", () => {
  const boundary = createWebAutomationHostRuntime(gateway([]).gateway);
  assert.equal(typeof boundary.signRouteEffect, "function");
  assert.equal(typeof boundary.routeEffectHolds, "function");
  const product: JsonObject = { page: { path: "/p/1042", controls: "Add to cart | Quantity" } };
  const added: JsonObject = { page: { path: "/p/1042", controls: "Add to cart | Quantity | View cart | Continue shopping" } };
  const outOfStock: JsonObject = { page: { path: "/p/2077", controls: "Quantity | Notify me" } };
  const effect = boundary.signRouteEffect!(product, added);
  assert.deepEqual(effect, webAutomationRouteEffect(product, added));
  assert.equal(boundary.routeEffectHolds!(effect, added), webAutomationRouteEffectHolds(effect, added));
  assert.equal(boundary.routeEffectHolds!(effect, added), true);
  assert.equal(boundary.routeEffectHolds!(effect, outOfStock), webAutomationRouteEffectHolds(effect, outOfStock));
  assert.equal(boundary.routeEffectHolds!(effect, outOfStock), false);
});

test("the boundary's expectation evaluator judges conditions through the same gateway", async () => {
  const { gateway: seam, calls } = gateway([{ ok: false, status: "failed", payload: { status: "failed", message: "Assertion did not hold: exists." } }]);
  const boundary = createWebAutomationHostRuntime(seam);
  const evaluation = await boundary.expectationEvaluator!([{ kind: "exists", selector: "#receipt" }], "all", 0, { source: "transition_comparison" });
  assert.equal(calls[0]?.outputId, "web.dom.assert");
  assert.equal(evaluation.passed, false);
  assert.equal(evaluation.checkedConditionCount, 1);
  assert.equal(evaluation.failure?.code, "web.validation.state_mismatch");
});
