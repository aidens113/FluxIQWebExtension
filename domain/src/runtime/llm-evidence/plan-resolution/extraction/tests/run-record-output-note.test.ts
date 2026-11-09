// The Flow's saved read says, in the step log, each column it was written with
// that its declared columns drop and nothing uses (t877).
//
// Run `run-mw49972k-cebf67e5` saved a read of title and price under a schema of
// title alone, and price left the saved read with no word anywhere. The answer
// keeps exactly the declared columns; the note is what makes the drop visible.

import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webPlanRunRecordOutput } from "../run-record-output";

/** That run's saved read, in stand-in selectors: title and price, and a mark read only to filter by. */
const listings: JsonObject = {
  item: "li.listing",
  fields: { title: { kind: "text", selector: "a.title" }, price: { kind: "text", selector: "span.amount" }, sponsored: { kind: "text", selector: ".sponsored", required: false } },
  where: [{ field: "sponsored", is: "absent" }],
  minItems: 0
};

const schemaOf = (...ids: string[]): JsonObject => ({ datasetId: "listings", writeMode: "append", schema: { schemaVersion: "0.1", fields: ids.map((id) => ({ id, label: id, valueType: "string" })) } });

/** The note lines a call writes into a step-log directory of its own. */
function notesOf(run: () => JsonObject): { lines: string[]; result: JsonObject } {
  const directory = mkdtempSync(path.join(tmpdir(), "fluxiq-saved-read-note-"));
  const before = process.env.FLUXIQ_LLM_STEP_LOG_DIR;
  process.env.FLUXIQ_LLM_STEP_LOG_DIR = directory;
  try {
    const result = run();
    const lines = readdirSync(directory).filter((name) => name.endsWith("-note"))
      .map((name) => (JSON.parse(readFileSync(path.join(directory, name, "meta.json"), "utf8")) as { line: string }).line);
    return { lines, result };
  } finally {
    if (before === undefined) delete process.env.FLUXIQ_LLM_STEP_LOG_DIR;
    else process.env.FLUXIQ_LLM_STEP_LOG_DIR = before;
    rmSync(directory, { recursive: true, force: true });
  }
}

test("t877: run mw49972k's read of title and price saved under a title schema notes price, and keeps only title", () => {
  const { lines, result } = notesOf(() => webPlanRunRecordOutput({ extractList: listings, recordOutput: schemaOf("title") }));
  assert.deepEqual(lines, ["A saved read drops a column it was written with that nothing uses, because its declared columns leave it out: price."]);
  // No widening: the saved schema is the declared one.
  const saved = (result.recordOutput as JsonObject).schema as { fields: { id: string }[] };
  assert.deepEqual(saved.fields.map((field) => field.id), ["title"]);
});

test("t877: a saved read that drops only a column a condition reads, or drops nothing, writes no note", () => {
  for (const recordOutput of [schemaOf("title", "price"), schemaOf("title", "price", "sponsored")]) {
    const { lines } = notesOf(() => webPlanRunRecordOutput({ extractList: listings, recordOutput }));
    assert.deepEqual(lines, [], JSON.stringify(recordOutput));
  }
});
