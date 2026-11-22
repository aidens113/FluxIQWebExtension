import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID } from "../../..";

const scope = { projectId: "project", flowId: "flow" };
const parameters: JsonObject = {
  extractList: { item: ".row", fields: { title: ".title", shipping: ".shipping", promoted: { kind: "text", selector: ".ad", mark: "flag" } }, minItems: 0 },
  recordOutput: { datasetId: "items", writeMode: "append", schema: { schemaVersion: "0.1", primaryKey: ["title"], fields: [
    { id: "title", label: "Title", valueType: "string", semanticType: "id" },
    { id: "shipping", label: "Shipping", valueType: "string", semanticType: "currency" },
    { id: "promoted", label: "Promoted", valueType: "string", semanticType: "flag", mark: "flag" }
  ] }, process: { columns: ["title"] } }
};

test("live and replay list reads carry the same complete dispatch metadata beside original rows", async () => {
  const rows = [{ title: "synthetic item", shipping: "$0.00", promoted: "Sponsored" }];
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session"],
    executeAction: async (_session, command) => command.actionType === "web.dom.capture_snapshot"
      ? { status: "succeeded", payload: { snapshot: { url: "https://example.test/list", title: "List", interactiveElements: [] } } }
      : { status: "succeeded", payload: { extracted: rows, extraction: { recordCount: 1, itemsSeen: 1, pagesRead: 1, truncated: false } } }
  });
  const live = await runtime.executeTool({ ...scope, callId: "live", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: async () => ({ permitted: true }), value: { node: "web.output.dom-extract_list", parameters, consequences: [] } });
  const replay = await runtime.executeTool({ ...scope, callId: "replay", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: async () => ({ permitted: true }), value: { replay: "step", node: "web.output.dom-extract_list", parameters, consequences: [] } });
  assert.equal(live.resultCode, "web.inspect.succeeded");
  assert.equal(replay.resultCode, "core.replay.replayed");
  assert.deepEqual(live.recordSchema, replay.recordSchema);
  assert.deepEqual(live.recordSchema?.primaryKey, ["title"]);
  assert.equal(live.recordSchema?.fields.find((field) => field.id === "shipping")?.semanticType, "currency");
  assert.equal(live.recordSchema?.fields.find((field) => field.id === "promoted")?.mark, "flag");
  assert.equal(live.recordSchema?.fields.length, 3);
  assert.equal(JSON.stringify(live.recordSchema).includes("$0.00"), false);
  assert.deepEqual(((live.evidence as JsonObject).read as JsonObject).extracted, rows);
});
