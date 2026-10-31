// The host runtime carries Core's two re-acquire seams (t786): `reacquireTarget`
// matches a stale item among its source's fresh answer by identity, and
// `returnToSourcePlace` puts the page back where the source step ran -- from
// the location the run's own capture recorded for that attempt -- before Core
// re-runs it.

import assert from "node:assert/strict";
import test from "node:test";
import type { OutputDispatchResult } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import type { AutomationStudioHostStateSnapshotRef, AutomationStudioUnboundTargetReacquireRequest } from "fluxiq/automation-studio";
import { webAutomationOutputNodeId } from "../../output-nodes";
import { createWebAutomationHostRuntime, type WebAutomationHostRuntimeGateway } from "../host-runtime";

const READ_NODE_ID = webAutomationOutputNodeId("web.dom.extract_list");
const CLICK_NODE_ID = webAutomationOutputNodeId("web.dom.click");
const FEED = "https://social.test/feed";
const PROFILE = "https://social.test/u/mara";

function snapshotAt(url: string): JsonObject {
  const snapshot = { url, title: "Feed", interactiveElements: [{ tagName: "main", selector: "main" }] };
  return { ok: true, status: "succeeded", payload: { status: "succeeded", result: { snapshot } } };
}

/** A browser on `start`; a navigation moves it unless `refuse` is set, and every command is recorded. */
function browser(start: string, refuse = false) {
  let at = start;
  const sent: Array<{ outputId: string; payload: JsonObject }> = [];
  const gateway: WebAutomationHostRuntimeGateway = {
    dispatch: async (request) => {
      sent.push({ outputId: request.outputId, payload: request.payload });
      if (request.outputId === "web.browser.navigate") {
        if (refuse) return { ok: false, outputId: request.outputId, error: "blocked" };
        at = String(request.payload.url);
        return { ok: true, outputId: request.outputId, payload: {} };
      }
      return { outputId: request.outputId, ...snapshotAt(at) } as OutputDispatchResult<JsonObject>;
    }
  };
  return { gateway, sent, moveTo: (url: string) => { at = url; } };
}

const read = { id: "read", definitionId: READ_NODE_ID, parameterValues: { extractList: { dedupe: { by: ["link"] } } } };
const like = { id: "like", definitionId: CLICK_NODE_ID, parameterValues: { selector: "#like" } };
const sourceAttempt = { attemptId: "read.attempt.1", outputs: {}, startedAt: 1 };

test("the host binds both re-acquire methods", () => {
  const boundary = createWebAutomationHostRuntime(browser(FEED).gateway);
  assert.equal(typeof boundary.reacquireTarget, "function");
  assert.equal(typeof boundary.returnToSourcePlace, "function");
  assert.equal(typeof boundary.reacquireUnboundTarget, "function");
});

const CONTROL = { tagName: "button", role: "button", accessibleName: "Apply preferences", visibleText: "Apply preferences", testId: "apply-control" };
const IDENTITY_LOCATION = "https://controls.test/preferences";
type SnapshotReply = Awaited<ReturnType<WebAutomationHostRuntimeGateway["dispatch"]>>;
type SnapshotRequest = Parameters<WebAutomationHostRuntimeGateway["dispatch"]>[0];

function identitySnapshot(frame = 0, changes: JsonObject = {}): JsonObject {
  return {
    url: frame === 0 ? IDENTITY_LOCATION : "https://controls.test/editor",
    frame: { isTop: frame === 0 },
    interactiveElements: [{ ...CONTROL, selector: "#fresh-apply", attributes: { "data-testid": "apply-control" } }],
    evidence: {
      elements: { scanned: 1, candidates: 1, matched: 1, returned: 1, truncated: false },
      loading: { documentState: "complete", busy: false, pendingNavigation: false },
      navigation: { timeOrigin: frame === 0 ? 10 : 20 },
      captureOptions: { includeHidden: true }
    },
    ...changes
  };
}

function identityBrowser() {
  const sent: SnapshotRequest[] = [];
  let transform: (reply: SnapshotReply, request: SnapshotRequest) => SnapshotReply | Promise<SnapshotReply> = (reply) => reply;
  const gateway: WebAutomationHostRuntimeGateway = {
    dispatch: async (request) => {
      sent.push(request);
      const frame = typeof request.payload.browserFrameId === "number" ? request.payload.browserFrameId : request.payload.browserFrameUrlPath === "/editor" ? 4 : 0;
      const reply: SnapshotReply = { ok: true, status: "succeeded", outputId: request.outputId, metadata: { sessionId: "paired.original" }, payload: { result: { snapshot: identitySnapshot(frame), sourceId: `tab:17:frame:${frame}` } } };
      return transform(reply, request);
    }
  };
  return { gateway, sent, change: (next: typeof transform) => { transform = next; } };
}

function identityNode(parameters: JsonObject = {}) {
  return { id: "apply", definitionId: CLICK_NODE_ID, definitionVersion: "1", parameterValues: { selector: "#old-apply", element: CONTROL, ...parameters } };
}

function identityRequest(beforeAction: AutomationStudioHostStateSnapshotRef | undefined, node = identityNode(), parameters: JsonObject = node.parameterValues): AutomationStudioUnboundTargetReacquireRequest {
  return {
    node, parameters,
    refresh: { container: "node", definitionId: CLICK_NODE_ID, definitionVersion: "1", parameterIds: ["selector", "element"], removableParameterIds: ["selector", "element"] },
    previousAttempt: { attemptId: "apply.attempt.1", ...(beforeAction === undefined ? {} : { beforeAction }) },
    failure: { category: "target_not_found", code: "web.target.not_found", retryable: true, effect: "unacted" }
  };
}

async function identityBefore(boundary: ReturnType<typeof createWebAutomationHostRuntime>, node = identityNode()) {
  return boundary.captureStateSnapshot!({ node, attemptId: "apply.attempt.1", inputs: {}, point: "before_action" });
}

test("native identity recovery uses the actual prior session/tab/frame and returns only selector and element sets", async () => {
  const page = identityBrowser();
  const boundary = createWebAutomationHostRuntime(page.gateway);
  const node = identityNode({ text: "keep this value", browserTabId: 17, checked: true });
  const before = await identityBefore(boundary, node);
  const request = identityRequest(before, node);
  const original = structuredClone(request.parameters);
  const answer = await boundary.reacquireUnboundTarget!(request);
  assert.equal(answer.outcome, "found");
  if (answer.outcome !== "found") return;
  assert.deepEqual(answer.patches.map((patch) => [patch.operation, patch.parameterId]), [["set", "selector"], ["set", "element"]]);
  assert.deepEqual(answer.patches[0], { operation: "set", parameterId: "selector", value: "#fresh-apply" });
  const fresh = answer.patches[1];
  assert.equal(fresh?.operation === "set" && (fresh.value as JsonObject).accessibleName, CONTROL.accessibleName);
  assert.deepEqual(request.parameters, original);
  const capture = page.sent.at(-1)!;
  assert.equal(capture.outputId, "web.dom.capture_snapshot");
  assert.equal(capture.metadata.sessionId, "paired.original", "this is the dispatcher's actual accepted selection field");
  assert.deepEqual(capture.payload, { includeHidden: true, browserTabId: 17, browserFrameId: 0 });
  assert.equal(capture.timeoutMs, 5_000);
});

test("policy recovery reads resolved inner output parameters and never patches the wrapper", async () => {
  const page = identityBrowser();
  const boundary = createWebAutomationHostRuntime(page.gateway);
  const before = await identityBefore(boundary);
  const saved = identityNode();
  const node = { ...saved, definitionId: "builtin.policy.action", parameterValues: { outputId: "web.dom.click", parameters: { selector: "$flow.old", element: { accessibleName: "$flow.old" } }, policyId: "policy.keep" } };
  const request: AutomationStudioUnboundTargetReacquireRequest = {
    ...identityRequest(before), node,
    parameters: { outputId: "web.dom.click", parameters: saved.parameterValues, policyId: "policy.keep" },
    refresh: { ...identityRequest(before).refresh, container: "output" }
  };
  const answer = await boundary.reacquireUnboundTarget!(request);
  assert.equal(answer.outcome, "found");
  assert.deepEqual(answer.outcome === "found" && answer.patches.map((patch) => patch.parameterId), ["selector", "element"]);
  assert.deepEqual(node.parameterValues.parameters.element, { accessibleName: "$flow.old" });
  assert.equal(request.parameters.policyId, "policy.keep");
});

test("unsupported outputs, bare selectors, row targets and missing correlation never launch a refresh capture", async () => {
  const page = identityBrowser();
  const boundary = createWebAutomationHostRuntime(page.gateway);
  const before = await identityBefore(boundary);
  const afterPrior = page.sent.length;
  for (const request of [
    identityRequest(before, identityNode(), { selector: "#old" }),
    identityRequest(before, identityNode(), { element: { ...CONTROL, context: { record: { values: ["row A"] } } } }),
    { ...identityRequest(before), node: { ...identityNode(), definitionId: READ_NODE_ID } },
    { ...identityRequest(before), refresh: { ...identityRequest(before).refresh, container: "output" as const } },
    identityRequest(undefined),
    { ...identityRequest(before), previousAttempt: { attemptId: "another.attempt", beforeAction: before } },
    identityRequest({ ...before, stateSnapshotId: "web.state.forged" })
  ]) assert.equal((await boundary.reacquireUnboundTarget!(request)).outcome, "unavailable");
  assert.equal(page.sent.length, afterPrior);
});

test("native recovery refuses a changed source, session, location or document without declaring gone", async () => {
  const transforms: Array<(reply: SnapshotReply) => SnapshotReply> = [
    (reply) => ({ ...reply, metadata: { sessionId: "paired.other" } }),
    (reply) => ({ ...reply, payload: { result: { snapshot: identitySnapshot(), sourceId: "tab:18:frame:0" } } }),
    (reply) => ({ ...reply, payload: { result: { snapshot: identitySnapshot(0, { url: "https://controls.test/elsewhere" }), sourceId: "tab:17:frame:0" } } }),
    (reply) => ({ ...reply, payload: { result: { snapshot: identitySnapshot(0, { evidence: { ...(identitySnapshot().evidence as JsonObject), navigation: { timeOrigin: 11 } } }), sourceId: "tab:17:frame:0" } } })
  ];
  for (const transform of transforms) {
    const page = identityBrowser();
    const boundary = createWebAutomationHostRuntime(page.gateway);
    const before = await identityBefore(boundary);
    page.change(transform);
    assert.deepEqual(await boundary.reacquireUnboundTarget!(identityRequest(before)), { outcome: "unavailable", reason: "place_unproved" });
  }
});

test("a real scoped child capture proves the child document while the ordinary summary remains top-owned", async () => {
  const page = identityBrowser();
  const boundary = createWebAutomationHostRuntime(page.gateway);
  const node = identityNode({ browserFrameId: 4, browserFrameUrlPath: "/editor" });
  const before = await identityBefore(boundary, node);
  assert.equal(before.summary?.documentTimeOrigin, 10);
  assert.deepEqual(before.from, { location: IDENTITY_LOCATION });
  assert.deepEqual(page.sent[1]!.payload, { includeHidden: true, browserTabId: 17, browserFrameId: 4, browserFrameUrlPath: "/editor" });
  assert.equal((await boundary.reacquireUnboundTarget!(identityRequest(before, node))).outcome, "found");
  assert.deepEqual(page.sent.at(-1)!.payload, { includeHidden: true, browserTabId: 17, browserFrameId: 4, browserFrameUrlPath: "/editor" });
  page.change((reply, request) => request.payload.browserFrameId === 4 ? { ...reply, payload: { result: { snapshot: identitySnapshot(4, { evidence: { ...(identitySnapshot(4).evidence as JsonObject), navigation: { timeOrigin: 21 } } }), sourceId: "tab:17:frame:4" } } } : reply);
  assert.deepEqual(await boundary.reacquireUnboundTarget!(identityRequest(before, node)), { outcome: "unavailable", reason: "place_unproved" });
});

test("unknown, failed and partial child provenance cannot be inferred from an unchanged top document", async () => {
  for (const mode of ["missing", "failed", "partial"] as const) {
    const page = identityBrowser();
    const boundary = createWebAutomationHostRuntime(page.gateway);
    const node = identityNode({ browserFrameId: 4, browserFrameUrlPath: "/editor" });
    page.change((reply, request) => {
      if (request.payload.browserFrameId !== 4) return reply;
      if (mode === "failed") return { ok: false, outputId: request.outputId, status: "timed_out" };
      const evidence = { ...(identitySnapshot(4).evidence as JsonObject), ...(mode === "partial" ? { loading: { documentState: "loading", busy: true, pendingNavigation: false } } : { captureOptions: {} }) };
      return { ...reply, payload: { result: { snapshot: identitySnapshot(4, { evidence }), sourceId: "tab:17:frame:4" } } };
    });
    const before = await identityBefore(boundary, node);
    page.change((reply) => reply);
    const reads = page.sent.length;
    assert.equal((await boundary.reacquireUnboundTarget!(identityRequest(before, node))).outcome, "unavailable");
    assert.equal(page.sent.length, reads);
  }
  const page = identityBrowser();
  const boundary = createWebAutomationHostRuntime(page.gateway);
  const topBefore = await identityBefore(boundary);
  assert.deepEqual(await boundary.reacquireUnboundTarget!(identityRequest(topBefore, identityNode({ browserFrameId: 4 }))), { outcome: "unavailable", reason: "place_unproved" });
});

test("a reused top ref preserves top provenance and obtains a fresh child prior for the current attempt", async () => {
  const page = identityBrowser();
  const boundary = createWebAutomationHostRuntime(page.gateway);
  const ended = await boundary.captureStateSnapshot!({ node: identityNode(), attemptId: "previous.attempt", inputs: {}, point: "after_action" });
  const node = identityNode({ browserFrameId: 4, browserFrameUrlPath: "/editor" });
  const before = await boundary.captureStateSnapshot!({ node, attemptId: "apply.attempt.1", inputs: {}, point: "before_action", previousStateRef: ended });
  assert.equal(before, ended);
  assert.equal(page.sent.length, 2, "reuse saves the top read while retaining the actual child read");
  assert.equal(before.summary?.documentTimeOrigin, 10);
  assert.equal((await boundary.reacquireUnboundTarget!(identityRequest(before, node))).outcome, "found");
});

test("native scope uses IO's canonical-first legacy alias precedence and refuses invalid scope", async () => {
  for (const [scope, frame] of [
    [{ tabId: 17, frameId: 4, browserFrameUrlPath: "/editor" }, 4],
    [{ browserTabId: 17, browserFrameId: 0, tabId: 99, frameId: 9 }, 0]
  ] as const) {
    const page = identityBrowser();
    const boundary = createWebAutomationHostRuntime(page.gateway);
    const node = identityNode(scope);
    const before = await identityBefore(boundary, node);
    const original = structuredClone(node.parameterValues);
    assert.equal((await boundary.reacquireUnboundTarget!(identityRequest(before, node))).outcome, "found");
    assert.equal(page.sent.at(-1)!.payload.browserTabId, 17);
    assert.equal(page.sent.at(-1)!.payload.browserFrameId, frame);
    assert.deepEqual(node.parameterValues, original);
  }
  for (const scope of [{ browserFrameId: -1, frameId: 4 }, { browserTabId: "invalid", tabId: 17 }, { browserFrameUrlPath: "/editor?token=unusable" }]) {
    const page = identityBrowser();
    const boundary = createWebAutomationHostRuntime(page.gateway);
    const node = identityNode(scope);
    const before = await identityBefore(boundary, node);
    const captured = page.sent.length;
    assert.deepEqual(await boundary.reacquireUnboundTarget!(identityRequest(before, node)), { outcome: "unavailable", reason: "unsupported_target" });
    assert.equal(page.sent.length, captured);
  }
});

test("observation failures, missing producer proof, hidden matches and ambiguity never become gone", async () => {
  for (const mode of ["failed", "cancelled", "marker", "partial", "hidden", "ambiguous"] as const) {
    const page = identityBrowser();
    const boundary = createWebAutomationHostRuntime(page.gateway);
    const before = await identityBefore(boundary);
    page.change((reply) => {
      if (mode === "failed" || mode === "cancelled") return { ...reply, ok: false, status: mode === "failed" ? "timed_out" : "cancelled" };
      const element = { ...CONTROL, selector: "#fresh-apply", attributes: { "data-testid": "apply-control" }, ...(mode === "hidden" ? { hidden: true } : {}) };
      const elements = mode === "ambiguous" ? [element, { ...element, selector: "#another-apply" }] : [element];
      const evidence = { ...(identitySnapshot().evidence as JsonObject), ...(mode === "marker" ? { captureOptions: {} } : {}), elements: { scanned: elements.length, candidates: elements.length, matched: elements.length, returned: elements.length, truncated: mode === "partial" } };
      return { ...reply, payload: { result: { snapshot: identitySnapshot(0, { evidence, interactiveElements: elements }), sourceId: "tab:17:frame:0" } } };
    });
    const answer = await boundary.reacquireUnboundTarget!(identityRequest(before));
    assert.ok(answer.outcome === "unavailable" || answer.outcome === "unmatched", mode);
  }
});

test("only a positively complete hidden-inclusive absence reports native gone", async () => {
  const page = identityBrowser();
  const boundary = createWebAutomationHostRuntime(page.gateway);
  const before = await identityBefore(boundary);
  page.change((reply) => ({ ...reply, payload: { result: { snapshot: identitySnapshot(0, { interactiveElements: [], evidence: { ...(identitySnapshot().evidence as JsonObject), elements: { scanned: 0, candidates: 0, matched: 0, returned: 0, truncated: false } } }), sourceId: "tab:17:frame:0" } } }));
  assert.deepEqual(await boundary.reacquireUnboundTarget!(identityRequest(before)), { outcome: "gone", coverage: "complete" });
});

test("abort before a capture and cancellation during its late response discard native patches", async () => {
  const page = identityBrowser();
  const boundary = createWebAutomationHostRuntime(page.gateway);
  const before = await identityBefore(boundary);
  const controller = new AbortController();
  controller.abort();
  assert.equal((await boundary.reacquireUnboundTarget!({ ...identityRequest(before), signal: controller.signal })).outcome, "unavailable");
  assert.equal(page.sent.length, 1);
  const late = new AbortController();
  page.change(async (reply) => {
    late.abort();
    await Promise.resolve();
    return reply;
  });
  assert.equal((await boundary.reacquireUnboundTarget!({ ...identityRequest(before), signal: late.signal })).outcome, "unavailable");
});

test("reacquireTarget finds a pass's row by the read's declared identity", async () => {
  const boundary = createWebAutomationHostRuntime(browser(FEED).gateway);
  const fresh = { title: "Kayak trip", link: "https://social.test/p/881", likes: "13" };
  const answer = await boundary.reacquireTarget!({
    node: like, source: read,
    lineage: { kind: "row", sourceNodeId: "read", outputKey: "records", loopNodeId: "each" },
    stale: { title: "Kayak trip", link: "https://social.test/p/881", likes: "12" },
    candidates: [{ title: "Kayak trip", link: "https://social.test/p/882", likes: "12" }, fresh],
    failure: { category: "target_not_found", code: "web.target.not_found", retryable: true }
  });
  assert.deepEqual(answer, { outcome: "found", value: fresh });
});

test("returnToSourcePlace stays when the page is where the source ran, and says so without moving", async () => {
  const page = browser(FEED);
  const boundary = createWebAutomationHostRuntime(page.gateway);
  await boundary.captureStateSnapshot!({ node: read, attemptId: sourceAttempt.attemptId, inputs: {}, point: "before_action" });
  assert.equal(await boundary.returnToSourcePlace!({ node: like, source: read, sourceAttempt }), "same_place");
  assert.equal(page.sent.filter((command) => command.outputId === "web.browser.navigate").length, 0);
});

test("returnToSourcePlace navigates back to the recorded location when the page moved", async () => {
  const page = browser(FEED);
  const boundary = createWebAutomationHostRuntime(page.gateway);
  await boundary.captureStateSnapshot!({ node: read, attemptId: sourceAttempt.attemptId, inputs: {}, point: "before_action" });
  // A later capture of the same attempt on another page does not move where it ran.
  page.moveTo(PROFILE);
  await boundary.captureStateSnapshot!({ node: read, attemptId: sourceAttempt.attemptId, inputs: {}, point: "after_action" });
  assert.equal(await boundary.returnToSourcePlace!({ node: like, source: read, sourceAttempt }), "returned");
  assert.deepEqual(page.sent.at(-1), { outputId: "web.browser.navigate", payload: { url: FEED } });
});

test("returnToSourcePlace is unavailable when the move fails, and same_place with nothing recorded", async () => {
  const page = browser(FEED, true);
  const boundary = createWebAutomationHostRuntime(page.gateway);
  await boundary.captureStateSnapshot!({ node: read, attemptId: sourceAttempt.attemptId, inputs: {}, point: "before_action" });
  page.moveTo(PROFILE);
  assert.equal(await boundary.returnToSourcePlace!({ node: like, source: read, sourceAttempt }), "unavailable");
  assert.equal(await boundary.returnToSourcePlace!({ node: like, source: read, sourceAttempt: { ...sourceAttempt, attemptId: "other.attempt.1" } }), "same_place");
  assert.equal(await boundary.returnToSourcePlace!({ node: like, source: read }), "same_place");
});
