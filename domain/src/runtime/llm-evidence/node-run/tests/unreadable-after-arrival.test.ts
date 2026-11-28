// An unreadable page in a build that has arrived (`run-mvy8n92p-95cfe1d0`, a
// look that timed out after the navigation had succeeded): the call is refused
// `page_unreadable` with the host's failure, never `not_at_start_location` with
// "go to <start>", which would send an arrived build back to the page it left.
// A build that has not arrived still gets where to go.

import assert from "node:assert/strict";
import test from "node:test";
import { runWithAutomationStudioEvidenceBuildScope } from "fluxiq/automation";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";

const PROJECT = { projectId: "project.unreadable", flowId: "flow.unreadable" };
const START = "http://127.0.0.1:41873/scenarios/job-board/";
const NAVIGATE = "web.output.browser-navigate";
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";

type Answer = Awaited<ReturnType<WebLlmEvidenceGateway["executeAction"]>>;
// The host answers a full record, as the extension reports it; a variable, so the stub is typed without a cast.
const HOST_FAILURE = { category: "action_failed", code: "web.action.timeout", retryable: true, stage: "execution" };
const TIMED_OUT: Answer = { status: "timed_out", failure: HOST_FAILURE };

type Runtime = ReturnType<typeof createWebAutomationLlmEvidenceRuntime>;

/** A tab whose snapshots answer `timed_out` once `unreadable.now` is set; everything else succeeds. */
function tab() {
  const state = { unreadable: false };
  const commands: string[] = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push(command.actionType);
      if (command.actionType === "web.dom.capture_snapshot") {
        if (state.unreadable) return TIMED_OUT;
        return { status: "succeeded", payload: { snapshot: { url: START, title: "Jobs", viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 }, interactiveElements: [{ tagName: "button", selector: "#go", visibleText: "Apply" }] } } };
      }
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return { gateway, state, commands };
}

async function exec(runtime: Runtime, callId: string, value: JsonObject, opening?: "fresh") {
  return await runWithAutomationStudioEvidenceBuildScope(
    opening ? { ...PROJECT, buildId: "build.unreadable", opening } : { ...PROJECT, buildId: "build.unreadable" },
    () => runtime.executeTool({ ...PROJECT, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START, value })
  );
}

const press = { node: CLICK, parameters: { target: { handle: "t1" } }, consequences: [] };

test("an arrived build whose page cannot be read is refused page_unreadable, never told to go to the start page", async () => {
  const stubbed = tab();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  await exec(runtime, "call.opening", { node: SNAPSHOT, parameters: {}, consequences: [] }, "fresh");
  assert.equal((await exec(runtime, "call.arrive", { node: NAVIGATE, parameters: { url: START }, consequences: [] })).resultCode, "web.action.succeeded");

  stubbed.state.unreadable = true;
  const refused = await exec(runtime, "call.press", press);

  assert.equal(refused.resultCode, "web.action.rejected.page_unreadable", JSON.stringify(refused.evidence));
  assert.equal(refused.effectApplied, false);
  assert.doesNotMatch(JSON.stringify(refused.evidence), /start_location_not_reached|startLocation/u);
  assert.equal(stubbed.commands.includes("web.dom.click"), false, "nothing was sent to the page");
  assert.match(JSON.stringify((refused as { failure?: unknown }).failure ?? null), /timed_out|timeout/iu, "the host failure rides on the refusal");
});

test("a build that has not arrived, on an unreadable page, still gets not_at_start_location", async () => {
  const stubbed = tab();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  stubbed.state.unreadable = true;
  const refused = await exec(runtime, "call.press", press, "fresh");
  assert.equal(refused.resultCode, "web.action.rejected.not_at_start_location");
});

test("an arrived build on an unreadable page can still navigate: a navigation is the way out", async () => {
  const stubbed = tab();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  await exec(runtime, "call.opening", { node: SNAPSHOT, parameters: {}, consequences: [] }, "fresh");
  await exec(runtime, "call.arrive", { node: NAVIGATE, parameters: { url: START }, consequences: [] });
  stubbed.state.unreadable = true;
  const went = await exec(runtime, "call.again", { node: NAVIGATE, parameters: { url: START }, consequences: [] });
  assert.equal(went.resultCode, "web.action.succeeded", JSON.stringify(went.evidence));
});
