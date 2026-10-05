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
//
// A target that is there and hidden is the same: a failure. Since t193-1002m
// the client reports it as `web.target.not_shown`, whose Core category is
// `target_not_found` so a Flow *run* finds the current step by state, but the
// replay reads the client's own code and answers `remembered` only for
// `web.target.not_found`. Lane A's run 40 depends on it: bigbox's "Set as my
// store", hidden inside a store chooser the Flow never opened, must keep
// failing the build's test (`../hidden-target.ts`).

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

test("actual replay reports ambiguity truthfully at either location without another acting command", async () => {
  for (const from of [START, "https://example.test/other"]) {
    const actions: string[] = [];
    const runtime = createWebAutomationLlmEvidenceRuntime(gatewayFailingClickWith(
      "web.target.ambiguous", "PRIVATE_CANDIDATE .private-selector PRIVATE_EXCEPTION", actions
    ));
    const replayed = await runtime.executeTool({
      ...PROJECT, callId: "dryrun.ambiguous", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
      value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [], from: { location: from } }
    });
    assert.equal(replayed.resultCode, "core.replay.failed");
    assert.equal(replayed.effectApplied, false);
    assert.equal(replayed.resultReason, "target_ambiguous");
    const answer = replayed.evidence as JsonObject;
    assert.equal(answer.ok, false);
    assert.equal(answer.reason, "target_ambiguous");
    assert.match(String(answer.said), /target_ambiguous/);
    assert.doesNotMatch(String(answer.said), /target_not_found/);
    for (const privateText of ["PRIVATE_CANDIDATE", ".private-selector", "PRIVATE_EXCEPTION"]) {
      assert.equal(JSON.stringify(replayed).includes(privateText), false);
    }
    assert.deepEqual(actions, ["web.dom.click"]);
  }
});

for (const [from, expected] of [[START, "core.replay.remembered"], ["https://example.test/other", "core.replay.unreproducible"]] as const) {
  test(`genuine missing target retains ${expected} without ambiguity or another action`, async () => {
    const actions: string[] = [];
    const runtime = createWebAutomationLlmEvidenceRuntime(gatewayFailingClickWith("web.target.not_found", undefined, actions));
    const replayed = await runtime.executeTool({
      ...PROJECT, callId: "dryrun.missing", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
      value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [], from: { location: from } }
    });
    assert.equal(replayed.resultCode, expected);
    assert.equal(replayed.effectApplied, false);
    assert.equal((replayed.evidence as JsonObject).reason, undefined);
    assert.notEqual(replayed.resultReason, "target_ambiguous");
    assert.deepEqual(actions, ["web.dom.click"]);
  });
}

test("a replayed step whose target is now ambiguous is failed, not unreproducible", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(gatewayFailingClickWith("web.target.ambiguous"));
  const replayed = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.3", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [] }
  });
  assert.equal(replayed.effectApplied, false);
  assert.equal(replayed.resultCode, "core.replay.failed");
});

test("a replayed step whose target is hidden is failed, never remembered", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(gatewayFailingClickWith("web.target.not_shown", "hidden: the element's display is none"));
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

function gatewayFailingClickWith(code: string, actual?: string, actions?: string[]): WebLlmEvidenceGateway {
  const failure = actual === undefined ? { code } : { code, actual };
  return {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: page() } };
      actions?.push(command.actionType);
      if (command.actionType === "web.dom.click") return { status: "failed", failure, error: "no" };
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
