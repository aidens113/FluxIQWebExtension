// Running the draft again as the Flow will run it, against a stub gateway.
//
// The reset is a navigation to the location the step recorded; a step is the
// node's own command with the parameters the Flow keeps; and the three ways a
// step can fail to replay are told apart here, because Core acts on which one
// it was and cannot work it out for itself.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebLlmEvidenceGateway
} from "../..";
import { webNodeRecordCount } from "../replay";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const START = "https://example.test/start";
const PERMITTED = async () => ({ permitted: true as const });

test("a step that ran records where it found the page and what it read", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const handle = ((looked.evidence as JsonObject & { elements: Array<{ target: string }> }).elements)[0]!.target;
  const pressed = await runtime.executeTool({
    ...PROJECT, callId: "call.two", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    value: { node: CLICK, parameters: { target: { handle } }, consequences: [] }
  });
  // The page it found, so a replay of the draft knows where to start. Only the
  // first proposed step's is ever used, and every step carries it.
  assert.deepEqual(pressed.draft?.replay?.from, { location: START });
});

test("a reset goes to the recorded location, through the navigate the Flow uses", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const reset = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.reset", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    permission: PERMITTED, value: { replay: "reset", from: { location: START } }
  });
  assert.equal(reset.resultCode, "core.replay.replayed");
  assert.equal(reset.effectApplied, true);
  const navigated = stubbed.commands.find((command) => command.actionType === "web.browser.navigate");
  assert.deepEqual(navigated?.parameters, { url: START });
});

test("a reset with no usable location refuses, so nothing is replayed from the wrong place", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  for (const from of [{}, { location: "file:///etc/passwd" }, { location: 7 }]) {
    const reset = await runtime.executeTool({
      ...PROJECT, callId: "dryrun.1.reset", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
      permission: PERMITTED, value: { replay: "reset", from }
    });
    assert.equal(reset.resultCode, "core.replay.reset_failed", JSON.stringify(from));
  }
  assert.equal(stubbed.commands.some((command) => command.actionType === "web.browser.navigate"), false);
});

test("a replayed step dispatches the node's own command with the parameters the Flow keeps", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const replayed = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [] }
  });
  assert.equal(replayed.resultCode, "core.replay.replayed");
  assert.equal(replayed.effectApplied, true);
  // The command the finished Flow dispatches, not a rehearsal of it. No handle
  // is resolved: the draft's parameters are already real.
  const clicked = stubbed.commands.find((command) => command.actionType === "web.dom.click");
  assert.deepEqual(clicked?.parameters, { selector: "#go" });
});

test("a step whose target is gone is unreproducible, and every other failure is a failure", async () => {
  const gone = stub({ clickFailure: { code: "web.target.not_found" } });
  const runtimeGone = createWebAutomationLlmEvidenceRuntime(gone.gateway);
  const missing = await runtimeGone.executeTool({
    ...PROJECT, callId: "dryrun.1.1", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [] }
  });
  // The one failure a page-level reset explains: a banner answered once stays
  // answered. Refusing it outright would push the model to delete the step.
  assert.equal(missing.resultCode, "core.replay.unreproducible");

  const broken = stub({ clickFailure: {} });
  const runtimeBroken = createWebAutomationLlmEvidenceRuntime(broken.gateway);
  const failed = await runtimeBroken.executeTool({
    ...PROJECT, callId: "dryrun.1.1", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [] }
  });
  assert.equal(failed.resultCode, "core.replay.failed");
  assert.equal(failed.effectApplied, false);
});

test("a step that read rows and now reads none has changed, which is the defect this exists for", async () => {
  const stubbed = stub({ payload: { extracted: [] } });
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const collapsed = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.4", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [], produced: { records: 16 } }
  });
  assert.equal(collapsed.resultCode, "core.replay.changed");

  // Fewer rows, or the same rows in another order, is the page and not the step.
  const fewer = stub({ payload: { extracted: [{ a: 1 }, { a: 2 }] } });
  const runtimeFewer = createWebAutomationLlmEvidenceRuntime(fewer.gateway);
  const still = await runtimeFewer.executeTool({
    ...PROJECT, callId: "dryrun.1.4", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [], produced: { records: 16 } }
  });
  assert.equal(still.resultCode, "core.replay.replayed");
});

test("a replayed step the run does not hold permission for does not act", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const refused = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.1", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    permission: async () => ({ permitted: false as const, missing: ["send_or_publish" as const], requestId: "request.one" }),
    value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: ["send_or_publish"] }
  });
  assert.equal(refused.resultCode, "core.replay.failed");
  assert.equal(stubbed.commands.some((command) => command.actionType === "web.dom.click"), false);
});

test("what a read produced is the longest list its payload carries", () => {
  assert.equal(webNodeRecordCount({ extracted: [1, 2, 3], extraction: { fields: ["a"] } }), 3);
  assert.equal(webNodeRecordCount({ extracted: [] }), 0);
  assert.equal(webNodeRecordCount({ value: "ok" }), undefined);
  assert.equal(webNodeRecordCount(undefined), undefined);
});

function stub(options: { clickFailure?: { code?: string }; payload?: JsonObject } = {}) {
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push({ actionType: command.actionType, parameters: command.parameters });
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: page() } };
      if (command.actionType === "web.dom.click" && options.clickFailure) {
        const code = options.clickFailure.code;
        return code === undefined ? { status: "failed", error: "no" } : { status: "failed", failure: { code }, error: "no" };
      }
      return { status: "succeeded", payload: options.payload ?? { value: "ok" } };
    }
  };
  return { gateway, commands };
}

function page(): JsonObject {
  return {
    url: START,
    title: "Fixture",
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [{ tagName: "button", selector: "#go", visibleText: "Go" }]
  };
}
