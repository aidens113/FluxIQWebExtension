// A replayed step whose only match was another row's control (t792).
//
// The client refuses a match that sits in a different row of a list than the
// step's own and says so on the result's resolution (`refusedBecause:
// "other-record"`). That control is on the page, so the step is not gone and
// the site does not "remember" it: the replay fails, in words that name the
// other row, on the very page the step acted on.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationFailureRecord } from "../../../../../failure";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../../..";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const ORDERS = "https://example.test/orders";
const PERMITTED = async () => ({ permitted: true as const });
const VALUE: JsonObject = { replay: "step", node: "web.output.dom-click", parameters: { selector: "#orders > tr:nth-of-type(2) > td > button" }, consequences: [], from: { location: ORDERS } };

function site(resolution: JsonObject | undefined): WebLlmEvidenceGateway {
  return {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") {
        return { status: "succeeded", payload: { snapshot: { url: ORDERS, title: "Orders", viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 }, interactiveElements: [{ tagName: "button", selector: "#other", visibleText: "Refresh" }] } } };
      }
      if (command.actionType === "web.dom.click") return { status: "failed", failure: webAutomationFailureRecord("web.target.not_found") as unknown as JsonObject, error: "no", payload: resolution ? { resolution } : {} };
      return { status: "succeeded", payload: {} };
    }
  };
}

async function replay(resolution: JsonObject | undefined) {
  const runtime = createWebAutomationLlmEvidenceRuntime(site(resolution));
  return await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.3", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: VALUE });
}

test("a press refused because its match is another row's control fails, and is not remembered", async () => {
  const answered = await replay({ strategy: "selector", candidateCount: 1, refusedBecause: "other-record" });
  assert.equal(answered.resultCode, "core.replay.failed");
  assert.equal((answered.evidence as JsonObject).ok, false);
  assert.match(String((answered.evidence as JsonObject).said), /another row's control/u);
});

test("a pass on a row whose own control is not found says so beside the code it reads as, for a forward run; a step with no row does not", async () => {
  const onARow = async (resolution: JsonObject | undefined) => await createWebAutomationLlmEvidenceRuntime(site(resolution)).executeTool({ ...PROJECT, callId: "fw.3.pass.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: { ...VALUE, item: { title: "Second order" } } });
  const refused = await onARow({ strategy: "selector", candidateCount: 1, refusedBecause: "other-record" });
  assert.equal(refused.resultCode, "core.replay.failed");
  assert.equal(refused.resultReason, "row_control_not_found");
  assert.equal(refused.effectApplied, false);
  const remembered = await onARow({ strategy: "selector", candidateCount: 1 });
  assert.equal(remembered.resultCode, "core.replay.remembered");
  assert.equal(remembered.resultReason, "row_control_not_found");
  assert.equal((await replay({ strategy: "selector", candidateCount: 1 })).resultReason, undefined);
  assert.notEqual((await replay({ strategy: "selector", candidateCount: 1, refusedBecause: "other-record" })).resultReason, "row_control_not_found");
});

test("the same miss without the refusal word is still remembered on the page it acted on", async () => {
  const answered = await replay({ strategy: "selector", candidateCount: 1 });
  assert.equal(answered.resultCode, "core.replay.remembered");
});
