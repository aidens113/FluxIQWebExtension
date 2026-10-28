// Whether the list goes on past a read of one page, on the wire (C2):
// `listContinues` is two closed words, copied when the page sends words this
// side knows, absent when it sends none, and -- as for every other member here
// -- anything else drops the whole summary rather than arriving half understood.
//
// It exists because live run `run-mveaaqxn-d0be9888` read 5 items of a list that
// went on loading as it was scrolled, and nothing in the read said so.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationExtractionListContinuesValue } from "../list-continues";
import { webAutomationExtractionSummaryValue } from "../summary";

const SUMMARY = { recordCount: 1, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["title"], itemsSeen: 5 };

test("every kind of continuing list is copied as sent", () => {
  const facts = [
    { kind: "next_page", evidence: "next_control" },
    { kind: "next_page", evidence: "following_page_number" },
    { kind: "load_more", evidence: "load_more_control" },
    { kind: "infinite_scroll", evidence: "declared_feed" },
    { kind: "infinite_scroll", evidence: "still_growing" },
    // Paused by the site, not ended: its loader answered the read's reveal with a notice to wait (t755).
    { kind: "infinite_scroll", evidence: "loader_asked_to_wait" },
    // Items carrying a closed control that opens more of the list (replies) (t762).
    { kind: "load_more", evidence: "unopened_replies" }
  ];
  for (const listContinues of facts) {
    assert.deepEqual(webAutomationExtractionSummaryValue({ ...SUMMARY, listContinues }), { ...SUMMARY, listContinues }, JSON.stringify(listContinues));
  }
});

test("a read whose list ended sends no fact, and its summary is unchanged by the member existing", () => {
  assert.deepEqual(webAutomationExtractionSummaryValue(SUMMARY), SUMMARY);
});

test("only the two words travel: anything a producer put beside them is left behind", () => {
  const copied = webAutomationExtractionListContinuesValue({ kind: "load_more", evidence: "load_more_control", label: "Show 20 more recipes" });
  assert.deepEqual(copied, { kind: "load_more", evidence: "load_more_control" });
});

test("a word outside either set, or a fact that is not an object, drops the whole summary", () => {
  for (const listContinues of [
    { kind: "endless", evidence: "declared_feed" },
    { kind: "next_page", evidence: "the button said More recipes" },
    { kind: "next_page" },
    "infinite_scroll",
    null,
    []
  ]) {
    assert.equal(webAutomationExtractionSummaryValue({ ...SUMMARY, listContinues }), undefined, JSON.stringify(listContinues));
  }
});
