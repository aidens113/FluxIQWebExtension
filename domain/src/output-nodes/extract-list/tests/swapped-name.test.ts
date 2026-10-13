// A name whose nearest column is a sibling of the one it means is refused, not
// guessed (t497, `../swapped-name.ts`). Generic names only: the rule reads the
// shape of a name, never what a scenario calls things.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import type { WebAutomationExtractField, WebAutomationExtractListRequest } from "../../../actions/extraction";
import { webExtractionMatchedColumn } from "../column-match";
import { webAutomationExtractListDispatch } from "../dispatch";
import { webAutomationStoredColumns } from "../stored-columns";
import { webExtractionNameSwapsPart } from "../swapped-name";

/** Hashed path keys in the detector's shape: one card's columns share its path. */
const TITLE = "div_xk2p9q7_xm4r8t1_a_xw3e6y2";
const ACTION = "div_xk2p9q7_xm4r8t1_div_xa7s5d3_xf9g1h4";
const COUNT = "div_xk2p9q7_xm4r8t1_span_xz8c2v6";
/** A key of a later detection of the same card, which this read does not have. */
const ELSEWHERE = "div_xk2p9q7_xm4r8t1_div_xq1w2e3_xf9g1h4";

const CARD: Record<string, WebAutomationExtractField> = {
  [TITLE]: { kind: "text", selector: "div.xk2p9q7 > a.xw3e6y2" },
  [ACTION]: { kind: "text", selector: "div.xk2p9q7 > div.xa7s5d3.xf9g1h4" },
  [COUNT]: { kind: "text", selector: "div.xk2p9q7 > span.xz8c2v6" }
};

/** Plain word keys, as a model or a table header names them. */
const WORDS: Record<string, WebAutomationExtractField> = {
  record_label: { kind: "text", selector: ".label" },
  record_action: { kind: "text", selector: "button" },
  item_count: { kind: "text", selector: ".count" }
};

const look = { headerOnly: false, wanted: undefined } as const;

test("a part swapped for another part is a different column; a name short, long, misspelt or sharing nothing is not", () => {
  // Same family, a different member on each side.
  assert.equal(webExtractionNameSwapsPart(ELSEWHERE, ACTION), true);
  assert.equal(webExtractionNameSwapsPart("record_outcome", "record_action"), true);
  assert.equal(webExtractionNameSwapsPart("Entry status", "Entry action"), true);
  // Written short or long: nothing replaced, only left out or added.
  assert.equal(webExtractionNameSwapsPart("label", "record_label"), false);
  assert.equal(webExtractionNameSwapsPart("record_label_text", "record_label"), false);
  // A token misspelt (Core's token credit), a whole name within Core's typo distance.
  assert.equal(webExtractionNameSwapsPart("record_lable", "record_label"), false);
  assert.equal(webExtractionNameSwapsPart("item-cnt", "item_count"), false);
  assert.equal(webExtractionNameSwapsPart("record-actoin", "record_action"), false);
  // A synonym is the same word (Core's synonyms: name/title, url/link).
  assert.equal(webExtractionNameSwapsPart("entry_title", "entry_name"), false);
  // Sharing nothing: no family, so no member was swapped.
  assert.equal(webExtractionNameSwapsPart("price", "p_xq1_span_currency_amount"), false);
});

test("the matcher refuses a key from another detection rather than reading the sibling column it is nearest to", () => {
  assert.equal(webExtractionMatchedColumn(ELSEWHERE, CARD, look), undefined);
  assert.equal(webExtractionMatchedColumn("record_outcome", WORDS, look), undefined);
  // The same matcher still guesses where the name only left a part out or slipped.
  assert.deepEqual(webExtractionMatchedColumn("label", WORDS, look)?.key, "record_label");
  assert.deepEqual(webExtractionMatchedColumn("record_lable", WORDS, look)?.key, "record_label");
  assert.deepEqual(webExtractionMatchedColumn("count", WORDS, look)?.key, "item_count");
  // A header is matched by the same rule.
  const table: Record<string, WebAutomationExtractField> = {
    state: { kind: "column", header: "Entry state" },
    act: { kind: "column", header: "Entry action" }
  };
  assert.equal(webExtractionMatchedColumn("Entry outcome", table, { headerOnly: true, wanted: undefined }), undefined);
  assert.deepEqual(webExtractionMatchedColumn("Entry actoin", table, { headerOnly: true, wanted: undefined })?.key, "act");
});

test("submit and dispatch agree: a record output naming a sibling column is refused by both, listing the read's columns", () => {
  const read: WebAutomationExtractListRequest = { item: "div.xk2p9q7", fields: CARD };
  const recordOutput = { datasetId: "d", process: { columns: [TITLE, ELSEWHERE] } };
  const stored = webAutomationStoredColumns(recordOutput, read);
  assert.equal(stored.ok, false, JSON.stringify(stored));
  if (!stored.ok) {
    assert.deepEqual(stored.unread.map((name) => name.written), [ELSEWHERE]);
    assert.deepEqual(stored.columns, [TITLE, ACTION, COUNT]);
  }
  const dispatch = webAutomationExtractListDispatch({ extractList: read as unknown as JsonObject, recordOutput });
  assert.equal(dispatch.ok, false);
  if (dispatch.ok) return;
  assert.deepEqual((dispatch.result.outputs?.error as JsonObject).issues, [
    { code: "record_output.column_not_read", field: ELSEWHERE, valid: [TITLE, ACTION, COUNT] },
    { code: "record_output.process_unknown_field", field: ELSEWHERE }
  ]);

  // A name written short still becomes its column on both sides.
  const short = { datasetId: "d", writeMode: "replace", process: { columns: ["count"] } };
  const words: WebAutomationExtractListRequest = { item: "li", fields: WORDS };
  const kept = webAutomationStoredColumns(short, words);
  assert.equal(kept.ok, true, JSON.stringify(kept));
  if (kept.ok) assert.deepEqual(kept.assumed.map((entry) => [entry.written, entry.field, entry.how]), [["count", "item_count", "nearest"]]);
  assert.equal(webAutomationExtractListDispatch({ extractList: words as unknown as JsonObject, recordOutput: short }).ok, true);
});
