import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { collectRecordedOracleAnswer } from "../collect.js";

// A generic two-page list of rentals, shaped as the domain's node run answers: rows under read.extracted, the list's
// key and page, and the validated schema the dispatch derived. Not a realistic scenario's data.
const schema = { schemaVersion: "0.1", fields: [
  { id: "title", label: "Title", valueType: "string" },
  { id: "rate", label: "Nightly rate", valueType: "string", semanticType: "currency" },
  { id: "featured", label: "Featured", valueType: "string", mark: "badge" },
] };
const value: JsonObject = { node: "fixture.read", parameters: { extractList: { handle: "extraction.1", fields: { title: "a", rate: "b", featured: "c" } } }, consequences: [] };
const answer = (rows: JsonObject[], place: string): JsonObject => ({ kind: "llm_evidence_tool_execution", effectApplied: true, evidence: { read: { extracted: rows, listKey: "fixture.rentals", place } }, recordSchema: schema });
const instructionText = "List every rental under $90 a night that is not featured, cheapest first, with columns title and rate.";

test("the reads become one answer through Core's own sink, ledger and data stage", async () => {
  const pageOne = [{ title: "Cabin", rate: "$80", featured: "Featured" }, { title: "Loft", rate: "$70" }, { title: "Barn", rate: "$95" }];
  const pageTwo = [{ title: "Loft", rate: "$70" }, { title: "Hut", rate: "$40" }];
  const result = await collectRecordedOracleAnswer({
    instructionText, referenceTimeMs: Date.UTC(2030, 0, 1),
    process: { where: [{ field: "rate", lessThan: 90 }, { field: "featured", is: "absent" }], sort: [{ field: "rate", order: "asc" }] },
    reads: [{ callId: "read.one", value, execution: answer(pageOne, "page=1") }, { callId: "read.two", value, execution: answer(pageTwo, "page=2") }],
  });
  assert.equal(result.readiness.state, "ready");
  assert.deepEqual(result.stored.map((entry) => entry.rows), [3, 2]);
  assert.deepEqual(result.answer.columns.map((column) => column.id), ["title", "rate"]);
  assert.deepEqual(result.answer.rows.map((row) => row.title), ["Hut", "Loft"]);
  assert.equal(result.collected?.rows.length, 5);
});

test("a condition over a field no read retained is withheld as missing evidence, never answered unfiltered", async () => {
  const result = await collectRecordedOracleAnswer({
    instructionText, referenceTimeMs: Date.UTC(2030, 0, 1),
    process: { where: [{ field: "rate", lessThan: 90 }, { field: "pets", is: "present" }] },
    reads: [{ callId: "read.one", value, execution: answer([{ title: "Loft", rate: "$70" }], "page=1") }],
  });
  assert.equal(result.readiness.state, "missing-evidence");
  assert.deepEqual(result.answer.rows, []);
});

test("a saved Flow's passes are pages of its one saved read step, told as a forward run tells them", async () => {
  const saved: JsonObject = { ...value, replay: "step", from: { location: "http://127.0.0.1:4100/rentals" } };
  const pass = (rows: JsonObject[], place: string): JsonObject => ({ kind: "llm_evidence_tool_execution", effectApplied: true, resultCode: "core.replay.replayed", evidence: { read: { extracted: rows, listKey: "fixture.rentals", place } }, recordSchema: schema });
  const result = await collectRecordedOracleAnswer({
    instructionText, referenceTimeMs: Date.UTC(2030, 0, 1),
    process: { where: [{ field: "rate", lessThan: 90 }] },
    reads: [{ callId: "pass.1", value: saved, execution: pass([{ title: "Loft", rate: "$70" }], "page=1") }, { callId: "pass.2", value: saved, execution: pass([{ title: "Hut", rate: "$40" }], "page=2") }],
  });
  assert.equal(result.readiness.state, "ready");
  assert.deepEqual(result.answer.rows.map((row) => row.title), ["Loft", "Hut"]);
});

test("Core's own binding finds a renamed column by the site label the domain stores beside the model's id (t997)", async () => {
  // As the domain stores a column the model renamed: id `badge`, label the detected key `member_badge`.
  const renamed = { schemaVersion: "0.1", fields: [
    { id: "title", label: "Title", valueType: "string" },
    { id: "rate", label: "Nightly rate", valueType: "string", semanticType: "currency" },
    { id: "badge", label: "member_badge", valueType: "string", mark: "badge" },
  ] };
  const read = (rows: JsonObject[]): JsonObject => ({ kind: "llm_evidence_tool_execution", effectApplied: true, evidence: { read: { extracted: rows, listKey: "fixture.rentals", place: "page=1" } }, recordSchema: renamed });
  const rows = [{ title: "Cabin", rate: "$80", badge: "Member" }, { title: "Loft", rate: "$70" }];
  for (const name of ["member_badge", "badge"]) {
    const result = await collectRecordedOracleAnswer({
      instructionText, referenceTimeMs: Date.UTC(2030, 0, 1),
      process: { where: [{ field: name, is: "present" }], columns: ["title", "rate"] },
      reads: [{ callId: "read.one", value, execution: read(rows) }],
    });
    assert.equal(result.readiness.state, "ready", name);
    assert.deepEqual(result.answer.rows.map((row) => row.title), ["Cabin"], name);
  }
});
