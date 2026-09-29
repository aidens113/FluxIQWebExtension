// A paginated read that came back short tells the model why it stopped paging,
// beside the counts it already tells it. A read of two records from one page of
// fifty is a selector to fix when the Next control named nothing, and a page to
// work around when the page ignored it; without the word the two are the same
// refusal. Live run `run-mulwm2dc-0bd95f22` stopped on page one for the second
// reason and its account said neither.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_FAILURE_CODES } from "../../../failure";
import { repeatedRejectionDetail } from "../../repeated-refusal";
import { webActionFailureRefusal } from "../refusal";

function failedRead(extraction: Record<string, unknown>) {
  return {
    status: "failed",
    failure: { code: WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, actual: "2 records from 1 page" },
    payload: { extraction } as unknown as JsonObject
  };
}

const SHORT = { recordCount: 2, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["title"], itemsSeen: 2 };

test("a paged read that fell short carries why it stopped paging, and keeps it when the answer repeats", () => {
  const refusal = webActionFailureRefusal(failedRead({ ...SHORT, paginationStop: "list_unchanged" }));
  assert.equal(refusal.detail?.reason, "fewer_records_than_required");
  assert.equal(refusal.detail?.paginationStop, "list_unchanged");
  assert.equal(refusal.detail?.recordsRead, 2);
  assert.equal(repeatedRejectionDetail(refusal.detail, 2).paginationStop, "list_unchanged");
});

test("a read that did not page carries no stop word, rather than an empty one", () => {
  const refusal = webActionFailureRefusal(failedRead(SHORT));
  assert.equal(refusal.detail?.reason, "fewer_records_than_required");
  assert.equal(Object.prototype.hasOwnProperty.call(refusal.detail ?? {}, "paginationStop"), false);
});
