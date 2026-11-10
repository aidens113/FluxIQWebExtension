// Task speed S0 and S10: every page read the host runtime makes for a Flow run
// (the state around each step, expectations, facts) is timed into the run's
// step, so a saved Flow's replay shows where its time after each act goes.

import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioLlmStepLogSpans } from "fluxiq/automation";
import type { OutputDispatchResult } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { captured } from "./host/captured";
import { webAutomationOutputNodeId } from "../../output-nodes";
import { createWebAutomationHostRuntime, type WebAutomationHostRuntimeGateway } from "../host-runtime";

const CLICK_NODE_ID = webAutomationOutputNodeId("web.dom.click");

const PAGE: JsonObject = {
  url: "https://library.test/",
  title: "Catalogue",
  viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0, documentWidth: 1280, documentHeight: 720, devicePixelRatio: 1 },
  interactiveElements: [{ tagName: "a", selector: "#home", accessibleName: "Home", visibleText: "Home", href: "https://library.test/", isVisibleOnViewport: true }]
};

/** A browser whose content script answers with its own start and end, as the extension's does. */
const seam: WebAutomationHostRuntimeGateway = {
  dispatch: async (request) => {
    const startedAt = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 2));
    return { outputId: request.outputId, ok: true, status: "succeeded", payload: { status: "succeeded", result: { snapshot: PAGE, startedAt, finishedAt: Date.now() } } } as OutputDispatchResult<JsonObject>;
  }
};

test("a state capture for a Flow run records its send and the page's share in the current step", async () => {
  const runtime = createWebAutomationHostRuntime(seam);
  const collected = automationStudioLlmStepLogSpans.collect(async () => await captured(runtime, { node: { id: "node.1", definitionId: CLICK_NODE_ID, parameterValues: {} }, attemptId: "a.1", inputs: {}, point: "after_action" }));
  const ref = await collected.done;
  assert.equal(typeof ref.summary?.page, "string");
  const spans = collected.spans();
  assert.deepEqual(spans.map((span) => span.name), ["send.capture_snapshot", "page.capture_snapshot"]);
  assert.equal(spans[0]!.detail, "succeeded");
  assert.ok(spans[1]!.startedAt >= spans[0]!.startedAt && spans[1]!.finishedAt <= spans[0]!.finishedAt, "the page's share lies inside the send");
});
