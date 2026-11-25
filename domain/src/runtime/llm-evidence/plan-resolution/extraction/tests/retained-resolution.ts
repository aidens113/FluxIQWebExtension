import assert from "node:assert/strict";
import { parseAutomationStudioRecordSchema } from "fluxiq/components/automation";
import type { JsonObject } from "fluxiq/core";
import type { WebAutomationExtractFieldSpec } from "../../../../../actions/extraction";
import { CAPTURED_DETECTIONS } from "../../../structure/tests/captured-detections";

/** Keep the existing resolution oracle, adding the fixture's complete inventory and the original view. */
export function assertRetainedResolution(actual: unknown, expected: unknown, message?: string): void {
  const wanted = expected as { status?: string; parameters?: JsonObject };
  if (wanted.status !== "resolved" || wanted.parameters === undefined) {
    assert.deepEqual(actual, expected, message);
    return;
  }
  const compared = structuredClone(actual) as { parameters: JsonObject };
  const complete = structuredClone(wanted) as { parameters: JsonObject };
  const actualPayload = compared.parameters.extractList === undefined ? compared.parameters.parameters as JsonObject : compared.parameters;
  const expectedPayload = complete.parameters.extractList === undefined ? complete.parameters.parameters as JsonObject : complete.parameters;
  const list = expectedPayload.extractList as JsonObject;
  const selected = list.fields as JsonObject;
  const capture = Object.values(CAPTURED_DETECTIONS).find(({ structure }) => structure.ok && structure.proposal.item === list.item);
  assert.ok(capture?.structure.ok, "expected request names a known captured list");
  const fields: JsonObject = structuredClone(selected);
  for (const { key, spec } of capture.structure.proposal.fields) {
    const optional: WebAutomationExtractFieldSpec = structuredClone(spec);
    if (optional.required === true) optional.required = false;
    if (Object.values(selected).some((field) => reading(field) === reading(optional))) continue;
    let under = key;
    for (let suffix = 2; Object.hasOwn(fields, under); suffix += 1) under = `${key}_${suffix}`;
    fields[under] = optional as unknown as JsonObject;
  }
  list.fields = fields;
  // The plan's own columns are the asked ones; every other retained reading is kept only (t1033).
  const actualList = actualPayload.extractList as JsonObject;
  if (Object.keys(fields).length > Object.keys(selected).length) assert.deepEqual(actualList.askedFields, Object.keys(selected), "the retained extras are kept only, so the read is told which columns were asked");
  if (actualList.askedFields !== undefined) {
    assert.deepEqual(actualList.askedFields, Object.keys(selected), "askedFields are the columns the plan named");
    delete actualList.askedFields;
  }
  const output = actualPayload.recordOutput as JsonObject;
  const schema = parseAutomationStudioRecordSchema(output?.schema);
  assert.equal(schema.ok, true, "retained schema is valid");
  if (schema.ok) {
    assert.deepEqual(schema.schema.fields.map((field) => field.id), Object.keys(fields), "schema describes every retained reading in order");
    assert.ok(schema.schema.fields.every((field) => field.valueType === "string"), "DOM values retain their physical representation");
  }
  assert.deepEqual((output.process as JsonObject).columns, Object.keys(selected), "the original requested columns remain the view");
  assert.equal(output.recordsPath, "result.extracted");
  assert.equal(output.writeMode, "append");
  delete actualPayload.recordOutput;
  assert.deepEqual(compared, complete, message);
}

function reading(field: unknown): string {
  if (typeof field !== "object" || field === null) return JSON.stringify(field);
  return JSON.stringify(Object.fromEntries(Object.entries(field).filter(([key]) => key !== "required").sort(([left], [right]) => left.localeCompare(right))));
}
