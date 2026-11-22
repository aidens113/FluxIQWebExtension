import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_DETECT_STRUCTURE_TOOL_ID, type WebLlmRepeatingStructure } from "@fluxiq-web-extension/domain";
import { webAutomationExtractListRequestValue } from "@fluxiq-web-extension/domain/client";
import { extractList } from "../../../list-reader";
import { el, page } from "../../selector-page";
import type { ExtractionCheckpoint } from "../../../../../shared/extraction-continuation";

const scope = { projectId: "project", flowId: "flow" };
const attribute = (name: string) => ({ kind: "attribute", attribute: `data-${name}`, required: true });
const detectedFields = { name: attribute("name"), price: attribute("price"), stock: attribute("stock"), evidence: attribute("evidence") };
const start: ExtractionCheckpoint = { records: [], pagesRead: 0, scrolls: 0, missingFields: [], itemsSeen: 0 };

async function resolvedList(written: JsonObject) {
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session"],
    structureDetectionSessionIds: () => ["session"],
    executeAction: async () => ({ status: "succeeded", payload: {
      snapshot: { url: "https://example.test/list", title: "List", interactiveElements: [] },
      structure: { ok: true, proposal: { container: "body", item: ".row", itemCount: 3, confidence: 0.9, fields: Object.entries(detectedFields).map(([key, spec]) => ({ key, label: key, spec, coverage: 1 })) } }
    } })
  });
  const detection = await runtime.executeTool({ ...scope, callId: "detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(detection.resultCode, "web.structure.detected");
  const handle = (detection.evidence as WebLlmRepeatingStructure).extraction;
  const resolved = await runtime.resolvePlanNodeParameters({ ...scope, nodeDefinitionId: "web.output.dom-extract_list", parameters: { extractList: { handle, ...written } }, declaredConsequences: [] });
  assert.equal(resolved.status, "resolved", JSON.stringify(resolved));
  if (resolved.status !== "resolved") throw new Error("expected resolved list");
  const request = webAutomationExtractListRequestValue(resolved.parameters.extractList);
  assert.ok(request);
  return { request, output: resolved.parameters.recordOutput as JsonObject };
}

async function read(request: NonNullable<ReturnType<typeof webAutomationExtractListRequestValue>>, rows: Array<Record<string, string>>) {
  const shown = page(el("body", {}, rows.map((row) => el("article", { class: "row", ...Object.fromEntries(Object.entries(row).map(([key, value]) => [`data-${key}`, value])) }))));
  try { return await extractList(request, { resume: start }); }
  finally { shown.restore(); }
}

test("retained field predicates select exactly the old inline-read rows for absent, present and negated clauses", async () => {
  const rows: Array<Record<string, string>> = [
    { name: "First", price: "$4", evidence: "first original" },
    { name: "Second", price: "$5", stock: "Sponsored", evidence: "second original" },
    { name: "Third", price: "$6", evidence: "third original" }
  ];
  const cases: Array<{ says: JsonObject; names: string[] }> = [
    { says: { is: "absent" }, names: ["First", "Third"] },
    { says: { is: "present" }, names: ["Second"] },
    { says: { contains: "Sponsored", not: true }, names: ["First", "Third"] }
  ];
  for (const { says, names } of cases) {
    const { request, output } = await resolvedList({ fields: ["name"], where: [{ field: "stock", ...says }] });
    assert.deepEqual(request.where, [{ field: "stock", ...says, ...(says.contains === undefined ? {} : { contains: ["Sponsored"] }) }]);
    assert.deepEqual(Object.keys(request.fields), ["name", "price", "stock", "evidence"]);
    assert.deepEqual((output.process as JsonObject).columns, ["name"]);
    const before = webAutomationExtractListRequestValue({ item: ".row", fields: { name: attribute("name") }, where: [{ read: attribute("stock"), ...says }] });
    assert.ok(before);
    const oldRows = (await read(before, rows)).records;
    const kept = (await read(request, rows)).records;
    assert.deepEqual(oldRows.map((row) => row.name), names);
    assert.deepEqual(kept.map((row) => row.name), names);
    for (const row of kept) assert.equal(row.evidence, rows.find((original) => original.name === row.name)!.evidence);
    assert.deepEqual(kept.map((row) => row.price), names.map((name) => rows.find((row) => row.name === name)!.price));
  }
});

test("authored true dedupe keeps its selected key, count and order while retaining each kept original", async () => {
  const rows: Array<Record<string, string>> = [
    { name: "Same", price: "$4", evidence: "first evidence" },
    { name: "Same", price: "$4", stock: "Sponsored", evidence: "different hidden evidence" },
    { name: "Distinct", price: "$5", evidence: "last evidence" }
  ];
  const { request, output } = await resolvedList({ fields: ["name", "price"], dedupe: true });
  assert.deepEqual(request.dedupe, { by: ["name", "price"] });
  assert.deepEqual((output.process as JsonObject).dedupe, { by: ["name", "price"] });
  const before = webAutomationExtractListRequestValue({ item: ".row", fields: { name: attribute("name"), price: attribute("price") }, dedupe: true });
  assert.ok(before);
  const oldRows = (await read(before, rows)).records;
  const kept = (await read(request, rows)).records;
  assert.deepEqual(kept.map(({ name, price }) => ({ name, price })), oldRows);
  assert.deepEqual(kept.map((row) => row.evidence), ["first evidence", "last evidence"]);
  assert.deepEqual(kept.map((row) => row.name), ["Same", "Distinct"]);
  const whole = await resolvedList({ dedupe: true });
  assert.deepEqual(whole.request.dedupe, { by: ["name", "price", "stock", "evidence"] });
  assert.equal((await read(whole.request, rows)).records.length, 3);
  const explicit = await resolvedList({ fields: ["name", "price"], dedupe: { by: ["evidence"] } });
  assert.deepEqual(explicit.request.dedupe, { by: ["evidence"] });
  assert.equal((await read(explicit.request, rows)).records.length, 3);
});
