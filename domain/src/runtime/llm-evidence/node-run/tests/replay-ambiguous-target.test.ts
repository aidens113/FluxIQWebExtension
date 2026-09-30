// A replayed step whose target became ambiguous is a failure, not a memory.
//
// `core.replay.unreproducible` exists for one situation: the reset is a page
// navigation, so a control the site stops serving once it has been answered --
// a consent banner, a soft check -- is simply not there on the replay
// (`../replay.ts`). Core used to ask the model once and afterwards let the step
// through; since 2026-09-30 it blocks until the step replays or the draft marks
// it optional or only_if (`AS/runtime/flow-draft/dry-run.ts`,
// `automationStudioFlowDraftReplayOutcomeBlocks`).
//
// A remembered answer removes a control; it never makes one selector match
// several. But `../../action-failure/refusal.ts` folds `web.target.ambiguous`
// into the same `target_not_found` word, and `../replay.ts` decides
// `unreproducible` from that word alone -- so a step the Flow cannot resolve
// would have been reported as a dismissed banner is, and under the old rule
// waved through after one question.
//
// Found while debugging `run-munaiz76-7026748c` (t174-w2). That run's two
// unreproducible steps were genuine absences -- each spent the full 3.75 s
// target-absent recovery ladder, which an ambiguous target does not retry --
// so this is a defect in the criterion, not the cause of that run's verdict.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebLlmEvidenceGateway
} from "../..";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const START = "https://example.test/start";
const PERMITTED = async () => ({ permitted: true as const });

test("a replayed step whose target is now ambiguous is failed, not unreproducible", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(gatewayFailingClickWith("web.target.ambiguous"));
  const replayed = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.3", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [] }
  });
  assert.equal(replayed.effectApplied, false);
  assert.equal(replayed.resultCode, "core.replay.failed");
});

test("a replayed step whose target is absent stays unreproducible", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(gatewayFailingClickWith("web.target.not_found"));
  const replayed = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.3", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [] }
  });
  assert.equal(replayed.resultCode, "core.replay.unreproducible");
});

function gatewayFailingClickWith(code: string): WebLlmEvidenceGateway {
  return {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: page() } };
      if (command.actionType === "web.dom.click") return { status: "failed", failure: { code }, error: "no" };
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
}

function page(): JsonObject {
  return {
    url: START,
    title: "Fixture",
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [
      { tagName: "button", selector: "#go", visibleText: "Go" },
      { tagName: "button", selector: "#go", visibleText: "Go" }
    ]
  };
}
