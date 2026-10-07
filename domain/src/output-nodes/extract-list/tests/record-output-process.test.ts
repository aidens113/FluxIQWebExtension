// The record output's post-processing a list read declares, in Core's own type
// (read-list redesign P3, S1): the read's `dedupe`, `sort`, `maxItems` and
// `minItems` mapped to `process`, which Core's record-output parser validates.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationExtractListRequestValue, type WebAutomationExtractListRequest } from "../../../actions/extraction";
import { webAutomationRecordOutputProcessOfRead } from "../record-output-process";

const FIELDS = { title: ".title", company: ".company", posted: ".posted", url: "a@href" };

function request(value: Record<string, unknown>): WebAutomationExtractListRequest {
  const read = webAutomationExtractListRequestValue({ item: "li.job", fields: FIELDS, ...value });
  assert.ok(read, JSON.stringify(value));
  return read;
}

test("every member maps to Core's processing, in its own words", () => {
  assert.deepEqual(
    webAutomationRecordOutputProcessOfRead(request({ dedupe: { by: ["url"] }, sort: [{ field: "posted", order: "desc", as: "date" }, "title"], maxItems: 25, minItems: 0 })),
    {
      process: { dedupe: { by: ["url"] }, sort: [{ field: "posted", order: "desc", as: "date" }, { field: "title", order: "asc" }], limit: 25, minRows: 0 },
      wholeRowDedupe: false
    }
  );
  assert.deepEqual(webAutomationRecordOutputProcessOfRead(request({})), { process: {}, wholeRowDedupe: false });
});

test("'list each once' is Core's default whole-row identity: no dedupe written, and said so", () => {
  for (const dedupe of [true, "unique", { by: ["title", "company", "posted", "url"] }, { by: ["url", "posted", "company", "title"] }]) {
    assert.deepEqual(webAutomationRecordOutputProcessOfRead(request({ dedupe })), { process: {}, wholeRowDedupe: true }, JSON.stringify(dedupe));
  }
});

test("a dedupe naming a subset of the columns is kept as written", () => {
  assert.deepEqual(webAutomationRecordOutputProcessOfRead(request({ dedupe: ["title", "company"] })).process, { dedupe: { by: ["title", "company"] } });
});
