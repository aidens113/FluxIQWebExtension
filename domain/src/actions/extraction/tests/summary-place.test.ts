// Where in its list a read was, on the wire (I3): `place` is a kind and a value the pager said, copied when it
// is well formed and dropped alone, never with the read, when it is not.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationExtractionPlaceText, webAutomationExtractionPlaceValue } from "../list-continues";
import { webAutomationExtractionSummaryValue } from "../summary";

const SUMMARY = { recordCount: 1, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["title"] };

test("a page, an offset and a cursor are copied as sent and said as one string", () => {
  const places = [{ kind: "page", value: 3 }, { kind: "offset", value: 0 }, { kind: "cursor", value: "abc-12_x.y~z" }] as const;
  for (const place of places) {
    assert.deepEqual(webAutomationExtractionSummaryValue({ ...SUMMARY, place }), { ...SUMMARY, place });
    assert.equal(webAutomationExtractionPlaceText(webAutomationExtractionPlaceValue(place)!), `${place.kind}=${place.value}`);
  }
});

test("a read whose pager said nothing has no place", () => {
  assert.deepEqual(webAutomationExtractionSummaryValue(SUMMARY), SUMMARY);
});

test("a place that is not well formed is dropped and the summary arrives without it", () => {
  for (const place of [{ kind: "page", value: 0 }, { kind: "page", value: 1.5 }, { kind: "offset", value: -1 }, { kind: "cursor", value: "two words" }, { kind: "cursor", value: "" }, { kind: "next", value: 2 }, 3, null]) {
    assert.deepEqual(webAutomationExtractionSummaryValue({ ...SUMMARY, place }), SUMMARY, JSON.stringify(place));
  }
});
