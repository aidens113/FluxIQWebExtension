// A read whose items are on the page and not shown says so, and what may show them (t903).
//
// On t903's browser proof the account menu's line was read while the menu was
// closed: one item found, one empty record, refused `records_have_no_fields`,
// "the fields are being read off the wrong element". The fields were right; the
// item was not rendered. The page now counts such items (`notRenderedItems`),
// and the refusal names that and its next step.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_FAILURE_CODES } from "../../../failure";
import { webActionFailureRefusal } from "../refusal";

function failedRead(extraction: Record<string, unknown>) {
  return {
    status: "failed",
    failure: { code: WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, actual: "1 record from 1 page" },
    payload: { extraction } as unknown as JsonObject
  };
}

const EMPTY = { recordCount: 1, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["following"], itemsSeen: 1, emptyRecords: 1 };

test("every record empty because its item is not rendered is items_not_rendered, with a hover or a click as the next step", () => {
  const refusal = webActionFailureRefusal(failedRead({ ...EMPTY, notRenderedItems: 1 }));
  assert.equal(refusal.detail?.reason, "items_not_rendered");
  assert.match(String(refusal.detail?.next), /a hover or a click/u);
});

test("every record empty with its items shown is still records_have_no_fields", () => {
  assert.equal(webActionFailureRefusal(failedRead(EMPTY)).detail?.reason, "records_have_no_fields");
  assert.equal(webActionFailureRefusal(failedRead({ ...EMPTY, recordCount: 2, emptyRecords: 2, notRenderedItems: 1 })).detail?.reason, "records_have_no_fields");
});
