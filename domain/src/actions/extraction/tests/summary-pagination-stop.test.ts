// Why a paginated read stopped paging, on the wire (C2): `paginationStop` is one
// closed word, copied when the page sends a word this side knows, absent when it
// sends none, and -- as for every other member here -- a word outside the set
// drops the whole summary rather than arriving half understood.
//
// It exists because live run `run-mulwm2dc-0bd95f22` stopped on page one of
// fifty and its account said nothing about why.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationExtractionSummaryValue } from "../summary";

const SUMMARY = { recordCount: 12, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["title", "link"] };

test("every stop word is copied as sent", () => {
  const words = ["control_absent", "control_disabled", "no_following_page", "scrolled_to_end", "list_vanished", "rate_limited", "page_limit", "item_limit", "deadline", "list_unchanged", "page_repeated", "control_not_clickable", "page_fault"];
  for (const paginationStop of words) {
    assert.deepEqual(webAutomationExtractionSummaryValue({ ...SUMMARY, paginationStop }), { ...SUMMARY, paginationStop }, paginationStop);
  }
});

test("a summary without a stop word is unchanged by the member existing", () => {
  assert.deepEqual(webAutomationExtractionSummaryValue(SUMMARY), SUMMARY);
});

test("a word outside the set, or one that is not a word, drops the whole summary", () => {
  assert.equal(webAutomationExtractionSummaryValue({ ...SUMMARY, paginationStop: "the Next button said Sold out" }), undefined);
  assert.equal(webAutomationExtractionSummaryValue({ ...SUMMARY, paginationStop: 3 }), undefined);
  assert.equal(webAutomationExtractionSummaryValue({ ...SUMMARY, paginationStop: null }), undefined);
});
