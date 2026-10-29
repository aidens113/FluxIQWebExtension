// The host runtime carries Core's two re-acquire seams (t786): `reacquireTarget`
// matches a stale item among its source's fresh answer by identity, and
// `returnToSourcePlace` puts the page back where the source step ran -- from
// the location the run's own capture recorded for that attempt -- before Core
// re-runs it.

import assert from "node:assert/strict";
import test from "node:test";
import type { OutputDispatchResult } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
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
