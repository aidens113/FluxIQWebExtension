// The host runtime boundary: state refs on web attempts, and nothing else.
//
// The proofs are that a web node's attempt gets a bounded, sanitized snapshot
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
  WEB_STATE_DIFF_SCHEMA_VERSION,
  webAutomationStateDiff,
  type WebAutomationHostRuntimeBoundary,
  type WebAutomationHostRuntimeGateway
} from "../host-runtime";

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

test("a web attempt gets a bounded, sanitized state ref sourced from web.dom.capture_snapshot", async () => {
  const snapshot = pageSnapshot("https://shop.test/cart?token=leaked-token", ["#pay"]);
  (snapshot.interactiveElements as JsonObject[]).push({ tagName: "input", selector: "#card", inputType: "text", value: "4111111111111111" });
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
  assert.equal(ref.summary?.schemaVersion, "web-llm-evidence.v2");
  assert.equal(ref.summary?.location, "https://shop.test/cart");
  // The sanitized packet's own rules apply, which is the point of reusing it:
  // the URL query never travels and neither does a control's value.
  assert.doesNotMatch(JSON.stringify(ref.summary), /leaked-token|4111111111111111/u);
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
  assert.equal(ref.summary?.schemaVersion, "web-llm-evidence.v2");
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
  assert.equal(both.removedElementCount, 0);
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

test("the diff reports the move, the counts, and which elements came and went, and stays inside the schema", () => {
  // `.v2` identifies an element by what it is and what it is called. The packet
  // stopped carrying selectors, and the opaque handle that replaced them is
  // positional -- `target.1` is the first element of whichever capture it came
  // from -- so a diff over handles would report that nothing ever changes.
  const before = { schemaVersion: "web-llm-evidence.v2", location: "https://shop.test/cart", title: "Cart", elements: [{ target: "target.1", tag: "button", name: "Pay" }, { target: "target.2", tag: "a", name: "Edit" }] };
  const after = { schemaVersion: "web-llm-evidence.v2", location: "https://shop.test/thanks", title: "Thanks", elements: [{ target: "target.1", tag: "a", name: "Edit" }, { target: "target.2", tag: "a", name: "Receipt" }] };
  const diff = webAutomationStateDiff(before, after, "web.state.1@a:before_action", "web.state.2@a:after_action");
  assert.deepEqual(diff, {
    schemaVersion: WEB_STATE_DIFF_SCHEMA_VERSION,
    beforeStateRef: "web.state.1@a:before_action",
    afterStateRef: "web.state.2@a:after_action",
    beforeLocation: "https://shop.test/cart",
    afterLocation: "https://shop.test/thanks",
    locationChanged: true,
    titleChanged: true,
    beforeElementCount: 2,
    afterElementCount: 2,
    addedElementCount: 1,
    removedElementCount: 1,
    addedElements: [{ tag: "a", name: "Receipt" }],
    removedElements: [{ tag: "button", name: "Pay" }]
  });
});

test("the diff never lists more than the bound, and its counts stay exact", () => {
  const many = { elements: Array.from({ length: 30 }, (_, index) => ({ target: `target.${index + 1}`, tag: "li", name: `Item ${index}` })) };
  const grown = webAutomationStateDiff({ elements: [] }, many);
  assert.equal(grown.addedElementCount, 30);
  assert.equal((grown.addedElements as unknown[]).length, 10);
  assert.equal(grown.locationChanged, false);
  assert.equal(grown.beforeElementCount, 0);
});

// `action-dispatch` is what Core asks of a host before a runtime repair that
// re-points an acting step may run; without it every executed target override
// was refused at preflight, in the Lab and the panel alike.
test("the boundary declares what it can answer, including action dispatch and the expectation seam", () => {
  const boundary = createWebAutomationHostRuntime(gateway([]).gateway);
  assert.deepEqual([...boundary.capabilities], ["action-dispatch", "state-snapshot", "state-diff", "expectation-evaluation", "route-state"]);
  assert.equal(typeof boundary.expectationEvaluator, "function");
  assert.equal(typeof boundary.inspectStateDiff, "function");
});

test("the route state a Router tests is the sanitized packet projected: location, dialog and control names, never a value or a query", async () => {
  const snapshot = pageSnapshot("https://shop.test/queue?token=leaked-token", ["#got-it"], {
    title: "Queue · Cadence",
    evidence: { dialogs: { open: [{ role: "dialog", label: "What's new in Cadence", modal: true }] } }
  });
  (snapshot.interactiveElements as JsonObject[]).push({ tagName: "input", selector: "#card", inputType: "text", value: "4111111111111111" });
  const { gateway: seam, calls } = gateway([{ ok: true, status: "succeeded", payload: { status: "succeeded", result: { snapshot } } }]);
  const boundary = createWebAutomationHostRuntime(seam);
  const state = await boundary.observeRouteState!({ projectId: "project.one", flowId: "flow.one" });
  assert.equal(calls[0]?.outputId, "web.dom.capture_snapshot");
  assert.equal(calls[0]?.timeoutMs, 5_000);
  const page = (state as { page: Record<string, unknown> }).page;
  assert.equal(page.path, "/queue");
  assert.equal(page.location, "https://shop.test/queue");
  assert.equal(page.dialog, "What's new in Cadence");
  assert.equal(typeof page.controls, "string");
  assert.doesNotMatch(JSON.stringify(state), /leaked-token|4111111111111111|#got-it|#card/u);
  assert.deepEqual(boundary.routeStatePaths?.map((entry) => entry.path), ["state.page.path", "state.page.location", "state.page.title", "state.page.dialog", "state.page.blockedBy", "state.page.controls"]);
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
