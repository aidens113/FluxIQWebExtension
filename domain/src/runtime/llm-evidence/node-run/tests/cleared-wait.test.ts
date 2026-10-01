// A node run whose command waited out a robot check that cleared by itself
// reports it to Core as `clearedWait`, beside `resultCode`; a run that met no
// such check, or whose payload says something malformed, carries no key.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebLlmEvidenceGateway
} from "../..";
import { toolExecution, WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS } from "../../capture";
import { withClearedWait } from "../cleared-wait";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";

test("Core's reader has learned clearedWait, so the key is not withheld", () => {
  assert.equal(WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS.includes("clearedWait"), true);
});

test("a press whose page waited out a check that cleared by itself carries clearedWait beside its result code", async () => {
  const pressed = await pressWith({ value: "ok", checkWait: { waitedMs: 8_412 } });
  assert.equal(pressed.resultCode, "web.action.succeeded");
  assert.deepEqual(pressed.clearedWait, { waitedMs: 8_412 });
});

test("a press that met no check carries no clearedWait key at all", async () => {
  const pressed = await pressWith({ value: "ok" });
  assert.equal(pressed.resultCode, "web.action.succeeded");
  assert.equal("clearedWait" in pressed, false);
});

test("a malformed or out-of-bounds wait adds nothing, and an extra field never rides along", () => {
  for (const checkWait of [{ waitedMs: -1 }, { waitedMs: 600_001 }, { waitedMs: "8000" }, { waitedMs: Number.NaN }, null, [], "8000"] as JsonValue[]) {
    const execution = withClearedWait({ checkWait }, toolExecution({}, true, "web.action.succeeded"));
    assert.equal("clearedWait" in execution, false, JSON.stringify(checkWait));
  }
  assert.equal("clearedWait" in withClearedWait(undefined, toolExecution({}, true, "web.action.succeeded")), false);
  const copied = withClearedWait({ checkWait: { waitedMs: 5_000.6, note: "page text" } }, toolExecution({}, true, "web.action.succeeded"));
  assert.deepEqual(copied.clearedWait, { waitedMs: 5_001 });
  assert.deepEqual(withClearedWait({ checkWait: { waitedMs: 600_000 } }, toolExecution({}, true, "web.action.succeeded")).clearedWait, { waitedMs: 600_000 });
});

async function pressWith(clickPayload: JsonObject) {
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: page() } };
      return { status: "succeeded", payload: clickPayload };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  assert.equal("clearedWait" in looked, false, "a look waits out nothing");
  const handle = ((looked.evidence as JsonObject & { elements: Array<{ target: string }> }).elements)[0]!.target;
  return await runtime.executeTool({ ...PROJECT, callId: "call.two", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle } }, consequences: [] } });
}

function page(): JsonObject {
  return {
    url: "https://example.test/start",
    title: "Fixture",
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [{ tagName: "button", selector: "#go", visibleText: "Go" }]
  };
}
