// A read whose items are on the page and not shown says so, and what may show them (t903).
//
// On t903's browser proof the account menu's line was read while the menu was
// closed and answered as a list with nothing in it. The page reads no item a
// person cannot see, and counts those it found (`notRenderedItems`), so the
// refusal names that and its next step: a hover or a click on what opens them.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_FAILURE_CODES } from "../../../failure";
import { webActionFailureRefusal } from "../refusal";

function failedRead(extraction: Record<string, unknown>) {
  return {
    status: "failed",
    failure: { code: WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, actual: "0 records from 1 page" },
    payload: { extraction } as unknown as JsonObject
  };
}

const NONE = { recordCount: 0, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["following"], itemsSeen: 1, listPresence: "appeared" };

test("no row read, and the list's items there and not shown, is items_not_rendered with a hover or a click as the next step", () => {
  const refusal = webActionFailureRefusal(failedRead({ ...NONE, notRenderedItems: 1 }));
  assert.equal(refusal.detail?.reason, "items_not_rendered");
  assert.match(String(refusal.detail?.next), /a hover or a click/u);
});

test("no row read with every item shown is still the old reason; rows read are never items_not_rendered", () => {
  assert.notEqual(webActionFailureRefusal(failedRead(NONE)).detail?.reason, "items_not_rendered");
  const rows = { ...NONE, recordCount: 2, emptyRecords: 2, itemsSeen: 3, notRenderedItems: 1 };
  assert.equal(webActionFailureRefusal(failedRead(rows)).detail?.reason, "records_have_no_fields");
});
