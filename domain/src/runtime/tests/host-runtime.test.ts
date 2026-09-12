// The host runtime boundary: state refs on web attempts, and nothing else.
//
// The defect this closes is that no web attempt carried `stateRefs` at all,
// because nothing downstream bound the boundary. So the proofs are that a web
// node's attempt now gets a bounded, sanitized snapshot; that a node which
// never touches the page is declined rather than costing a gateway round trip;
// and that the diff says what moved without restating what the page says.

import assert from "node:assert/strict";
import test from "node:test";
import type { OutputDispatchResult } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../output-nodes";
import { createWebAutomationHostRuntime, WEB_STATE_DIFF_SCHEMA_VERSION, webAutomationStateDiff, type WebAutomationHostRuntimeGateway } from "../host-runtime";

const CLICK_NODE_ID = webAutomationOutputNodeId("web.dom.click");

function pageSnapshot(url: string, selectors: string[], extra: JsonObject = {}): JsonObject {
  return {
    url,
    title: "Checkout",
    ...extra,
    interactiveElements: selectors.map((selector) => ({ tagName: "button", selector, name: selector.replace(/[#.]/gu, "") }))
  };
}

function gateway(answers: Array<Partial<OutputDispatchResult<JsonObject>>>): { gateway: WebAutomationHostRuntimeGateway; calls: Array<{ outputId: string; metadata: JsonObject }> } {
  const calls: Array<{ outputId: string; metadata: JsonObject }> = [];
  return {
    calls,
    gateway: {
      dispatch: async (request) => {
        calls.push({ outputId: request.outputId, metadata: request.metadata });
        const answer = answers[calls.length - 1] ?? { ok: false, error: "no answer" };
        return { outputId: request.outputId, ok: false, ...answer } as OutputDispatchResult<JsonObject>;
      }
    }
  };
}

function captureInput(definitionId: string, point: "before_action" | "after_action" = "before_action") {
  return { node: { id: "node.1", definitionId, parameterValues: {} }, attemptId: "node.1.attempt.1", inputs: {}, point } as const;
}

test("a web attempt gets a bounded, sanitized state ref sourced from web.dom.capture_snapshot", async () => {
  const snapshot = pageSnapshot("https://shop.test/cart?token=leaked-token", ["#pay"]);
  (snapshot.interactiveElements as JsonObject[]).push({ tagName: "input", selector: "#card", inputType: "text", value: "4111111111111111" });
  const { gateway: seam, calls } = gateway([{ ok: true, status: "succeeded", payload: { status: "succeeded", result: { snapshot } } }]);
  const boundary = createWebAutomationHostRuntime(seam);
  const ref = await boundary.captureStateSnapshot!(captureInput(CLICK_NODE_ID));

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.outputId, "web.dom.capture_snapshot");
  assert.equal(calls[0]?.metadata.point, "before_action");
  assert.equal(calls[0]?.metadata.attemptId, "node.1.attempt.1");
  assert.equal(ref.stateSnapshotId, "web.state.1");
  assert.equal(ref.stateRef, "web.state.1@node.1.attempt.1:before_action");
  assert.equal(typeof ref.capturedAt, "number");
  assert.equal(ref.summary?.schemaVersion, "web-llm-evidence.v1");
  assert.equal(ref.summary?.location, "https://shop.test/cart");
  // The sanitized packet's own rules apply, which is the point of reusing it:
  // the URL query never travels and neither does a control's value.
  assert.doesNotMatch(JSON.stringify(ref.summary), /leaked-token|4111111111111111/u);
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

test("the diff reports the move, the counts, and the selectors, and stays inside the schema", () => {
  const before = { schemaVersion: "web-llm-evidence.v1", location: "https://shop.test/cart", title: "Cart", elements: [{ selector: "#pay" }, { selector: "#edit" }] };
  const after = { schemaVersion: "web-llm-evidence.v1", location: "https://shop.test/thanks", title: "Thanks", elements: [{ selector: "#edit" }, { selector: "#receipt" }] };
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
    addedSelectors: ["#receipt"],
    removedSelectors: ["#pay"]
  });
});

test("the diff survives a missing side and never lists more than the bound", () => {
  const many = { elements: Array.from({ length: 30 }, (_, index) => ({ selector: `#item-${index}` })) };
  const grown = webAutomationStateDiff(undefined, many);
  assert.equal(grown.addedElementCount, 30);
  assert.equal((grown.addedSelectors as string[]).length, 10);
  assert.equal(grown.locationChanged, false);
  assert.equal(grown.beforeElementCount, 0);
});

test("the boundary declares what it can answer, including the expectation seam", () => {
  const boundary = createWebAutomationHostRuntime(gateway([]).gateway);
  assert.deepEqual([...boundary.capabilities], ["state-snapshot", "state-diff", "expectation-evaluation"]);
  assert.equal(typeof boundary.expectationEvaluator, "function");
  assert.equal(typeof boundary.inspectStateDiff, "function");
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
