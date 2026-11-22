import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_DETECT_STRUCTURE_TOOL_ID, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmRepeatingStructure } from "../../..";

const scope = { projectId: "project", flowId: "flow" };
const rows: JsonObject[] = [
  { id: "one", title: "First synthetic item", shipping: "$0.00", promoted: "Sponsored" },
  { id: "two", title: "Second synthetic item", shipping: "$2.50" },
  { id: "three", title: "Third synthetic item", shipping: "$1.25" }
];

function capture(): JsonObject[] {
  const elements: JsonObject[] = [{ tagName: "main", selector: "main" }];
  for (const [index, row] of rows.entries()) {
    const item = `main > article:nth-of-type(${index + 1})`;
    const context = { listPosition: { index: index + 1, total: rows.length } };
    const attributes: JsonObject = { class: "row", "data-id": row.id! };
    if (row.promoted !== undefined) attributes["data-promoted"] = row.promoted;
    const parent = elements.push({ tagName: "article", selector: item, attributes, parent: 0, context }) - 1;
    elements.push({ tagName: "h2", selector: `${item} > h2`, visibleText: row.title!, parent, context });
    elements.push({ tagName: "span", selector: `${item} > span`, visibleText: row.shipping!, attributes: { class: "shipping" }, parent, context });
  }
  return elements;
}

test("live and replay list reads carry the same complete dispatch metadata beside original rows", async () => {
  const structure = { ok: true, proposal: { container: "main", item: "main > article.row", itemCount: rows.length, confidence: 0.9, fields: [
    { key: "id", label: "Item id", spec: { kind: "attribute", attribute: "data-id", required: true }, coverage: 1 },
    { key: "title", label: "Title", spec: { kind: "text", selector: ":scope > h2", required: true }, coverage: 1 },
    { key: "shipping", label: "Shipping", spec: { kind: "text", selector: ":scope > span.shipping", required: true }, coverage: 1 },
    { key: "promoted", label: "Promoted", spec: { kind: "attribute", attribute: "data-promoted", mark: "flag", required: false }, coverage: 1 / 3 }
  ] } };
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session"],
    structureDetectionSessionIds: () => ["session"],
    executeAction: async (_session, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded", payload: { extracted: rows, extraction: { recordCount: rows.length, itemsSeen: rows.length, pagesRead: 1, truncated: false } } };
      const payload: JsonObject = { snapshot: { url: "https://example.test/list", title: "List", interactiveElements: capture() } };
      if (command.parameters.detectStructure !== undefined) payload.structure = structure;
      return { status: "succeeded", payload };
    }
  });
  await runtime.executeTool({ ...scope, callId: "look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const detected = await runtime.executeTool({ ...scope, callId: "detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(detected.resultCode, "web.structure.detected");
  const packet = detected.evidence as WebLlmRepeatingStructure;
  assert.deepEqual(packet.rowIdentity, ["id"]);
  const live = await runtime.executeTool({ ...scope, callId: "live", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: async () => ({ permitted: true }), value: {
    node: "web.output.dom-extract_list", parameters: { extractList: { handle: packet.extraction, fields: ["title"], minItems: 0 }, recordOutput: { datasetId: "items", writeMode: "append", process: { columns: ["title"] } } }, consequences: []
  } });
  assert.equal(live.resultCode, "web.inspect.succeeded", JSON.stringify(live.evidence));
  const saved = live.draft?.ranWith as { node: string; parameters: JsonObject; consequences: [] };
  const replay = await runtime.executeTool({ ...scope, callId: "replay", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: async () => ({ permitted: true }), value: { ...saved, replay: "step" } });
  assert.equal(replay.resultCode, "core.replay.replayed");
  assert.equal(live.failure, undefined);
  assert.equal(replay.failure, undefined);
  assert.deepEqual(live.recordSchema, replay.recordSchema);
  assert.deepEqual(live.recordSchema?.primaryKey, ["id"]);
  assert.equal(live.recordSchema?.fields.find((field) => field.id === "shipping")?.semanticType, "currency");
  assert.equal(live.recordSchema?.fields.find((field) => field.id === "promoted")?.mark, "flag");
  assert.equal(live.recordSchema?.fields.length, 4);
  assert.equal(JSON.stringify(live.recordSchema).includes("$0.00"), false);
  const observed = ((live.evidence as JsonObject).read as JsonObject).extracted;
  assert.deepEqual(observed, rows);
  assert.deepEqual(replay.outputs?.records, observed);
});
