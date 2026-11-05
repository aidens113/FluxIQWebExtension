// Why a Flow would refuse a list read, as the Flow's own dispatch says it (t869).

import assert from "node:assert/strict";
import test from "node:test";
import { webListReadFlowRefused } from "../flow-refused";

const READ = { item: ".row", fields: { title: ".title" } };
const OUTPUT = { datasetId: "working", writeMode: "replace", purpose: "intermediate", schema: { schemaVersion: "0.1", fields: [{ id: "title", label: "Title", valueType: "string" }] } };
const LIST = "web.dom.extract_list";

test("dedupe on a working list is refused, by the dispatch's own codes", () => {
  const codes = webListReadFlowRefused(LIST, { extractList: { ...READ, dedupe: true }, recordOutput: OUTPUT });
  assert.deepEqual(codes, ["record_output.invalid", "record_output.intermediate_process_unsupported"]);
});

test("the same read with no dedupe, and the same dedupe on a list that is kept, are not", () => {
  assert.equal(webListReadFlowRefused(LIST, { extractList: READ, recordOutput: OUTPUT }), undefined);
  const { purpose: _purpose, ...kept } = OUTPUT;
  assert.equal(webListReadFlowRefused(LIST, { extractList: { ...READ, dedupe: true }, recordOutput: kept }), undefined);
});

test("a read that goes through pages by itself is refused, and any other node is never asked", () => {
  assert.deepEqual(webListReadFlowRefused(LIST, { extractList: { ...READ, paginate: { next: "a.next", maxPages: 5 } } }), ["web.extract_list.paginate_retired"]);
  assert.equal(webListReadFlowRefused("web.dom.click", { extractList: { ...READ, dedupe: true }, recordOutput: OUTPUT }), undefined);
});
