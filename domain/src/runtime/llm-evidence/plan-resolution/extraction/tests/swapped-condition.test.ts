// A condition naming a column its read does not have is refused at submit with
// the read's columns, never read as the sibling column nearest to it (t497).
//
// The case is lane D round 15 (`run-mv6ep5oy-05d5095c`, D1): a `where` key from
// a later detection, on a read of an earlier one, resolved to that read's
// button column and kept exactly the rows the condition was written to leave
// out. Generic names only.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationExtractField } from "../../../../../actions/extraction";
import { createWebLlmExtractionHandles, type WebLlmExtractionHandleScope } from "../../../structure";
import { keptWebExtractionConditions } from "../conditions";
import { resolveWebExtractionSlot } from "../slot";

const TITLE = "div_xk2p9q7_xm4r8t1_a_xw3e6y2";
const ACTION = "div_xk2p9q7_xm4r8t1_div_xa7s5d3_xf9g1h4";
const COUNT = "div_xk2p9q7_xm4r8t1_span_xz8c2v6";
/** A key of a later detection of the same card: a status text this read has no column for. */
const ELSEWHERE = "div_xk2p9q7_xm4r8t1_div_xq1w2e3_xf9g1h4";

const CARD: Record<string, WebAutomationExtractField> = {
  [TITLE]: { kind: "text", selector: "div.xk2p9q7 > a.xw3e6y2" },
  [ACTION]: { kind: "text", selector: "div.xk2p9q7 > div.xa7s5d3.xf9g1h4" },
  [COUNT]: { kind: "text", selector: "div.xk2p9q7 > span.xz8c2v6" }
};

test("a condition on another detection's key is refused at its field, naming it and listing the columns it can use", () => {
  const kept = { title: CARD[TITLE]! };
  const where = keptWebExtractionConditions([{ field: ELSEWHERE, is: "present" }], { detected: CARD, kept }, ["where"]);
  assert.deepEqual(where, {
    ok: false,
    issue: "web.handle.unknown_field",
    path: ["where", 0, "field"],
    issues: [{ code: "web.handle.unknown_field", field: ELSEWHERE, valid: ["title", TITLE, ACTION, COUNT] }]
  });
});

test("a condition on a plain word with one part swapped is refused the same way; one with a part left out is still a guess", () => {
  const words: Record<string, WebAutomationExtractField> = {
    record_label: { kind: "text", selector: ".label" },
    record_action: { kind: "text", selector: "button" }
  };
  const swapped = keptWebExtractionConditions([{ field: "record_outcome", contains: "done" }], { detected: words, kept: {} }, ["where"]);
  assert.equal(swapped.ok, false);
  if (!swapped.ok) assert.deepEqual(swapped.issues, [{ code: "web.handle.unknown_field", field: "record_outcome", valid: ["record_label", "record_action"] }]);

  const short = keptWebExtractionConditions([{ field: "action", is: "present" }], { detected: words, kept: {} }, ["where"]);
  assert.equal(short.ok, true, JSON.stringify(short));
  if (short.ok) assert.deepEqual(short.assumed.map((entry) => [entry.written, entry.field, entry.how]), [["action", "record_action", "nearest"]]);
});

test("the resolved slot's refusal carries the issue, so the step's refusal can say it", () => {
  const scope: WebLlmExtractionHandleScope = { projectId: "project.one", flowId: "flow.one" };
  const handles = createWebLlmExtractionHandles();
  const handle = handles.reserve();
  handles.retain(scope, { handle, location: "http://127.0.0.1:4173/list/", extractList: { item: "div.xk2p9q7", fields: CARD }, itemCount: 8 });
  const slot = resolveWebExtractionSlot({ handle, fields: { title: TITLE }, where: [{ field: ELSEWHERE, is: "present" }] }, scope, handles);
  assert.deepEqual(slot, {
    status: "refused",
    issue: "web.handle.unknown_field",
    path: ["where", 0, "field"],
    issues: [{ code: "web.handle.unknown_field", field: ELSEWHERE, valid: ["title", TITLE, ACTION, COUNT] }]
  });
});
