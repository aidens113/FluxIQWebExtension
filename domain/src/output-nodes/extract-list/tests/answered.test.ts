// A list read's answer names the list it read and the place its pager said, beside the rows (invariant I3):
// for a saved Flow's read, and for the model's own read of the same list.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webListReadAnswerKeys } from "../../../runtime/llm-evidence/node-run/list-read";
import { webAutomationExtractListAnswered } from "../answered";
import { webAutomationExtractListKey } from "../list-key";

const ITEM = "main > table.timetable > tbody > tr";
const PARAMETERS: JsonObject = { extractList: { item: ITEM, fields: { train: { kind: "text", selector: "td.train" } } } };
const SUMMARY = { recordCount: 2, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["train"] };
const answer = (extraction: JsonObject): JsonObject => ({ extracted: [{ train: "IC 12" }, { train: "RE 7" }], extraction, snapshot: { url: "https://rail.test/times?page=3" } });

test("the answer carries the key of the list the read ran, the same one a detection of that list gets", () => {
  const stamped = webAutomationExtractListAnswered(PARAMETERS, answer(SUMMARY)) as JsonObject;
  assert.equal(stamped.listKey, webAutomationExtractListKey({ item: ITEM }));
  assert.deepEqual(stamped.extracted, [{ train: "IC 12" }, { train: "RE 7" }]);
  assert.equal(Object.hasOwn(stamped, "place"), false, "a pager that said nothing leaves no place, and none is made from the address or the rows");
  const inFrame = webAutomationExtractListAnswered({ ...PARAMETERS, browserFrameId: 2, browserFrameUrlPath: "/embed/times" }, answer(SUMMARY)) as JsonObject;
  assert.notEqual(inFrame.listKey, stamped.listKey);
});

test("numbered, next-link and load-more paging each name their place", () => {
  const places: Array<[JsonObject, string]> = [
    [{ kind: "page", value: 3 }, "page=3"], // numbered pager: the number it marks current
    [{ kind: "page", value: 2 }, "page=2"], // next-link pager: a page marked current beside its Next
    [{ kind: "offset", value: 40 }, "offset=40"], // load-more control that counts its items
    [{ kind: "cursor", value: "Zm9v-bar_1" }, "cursor=Zm9v-bar_1"] // load-more control that carries a cursor
  ];
  for (const [place, text] of places) {
    const stamped = webAutomationExtractListAnswered(PARAMETERS, answer({ ...SUMMARY, place })) as JsonObject;
    assert.equal(stamped.place, text);
  }
});

test("a place that is not well formed is left out and the read is kept", () => {
  for (const place of [{ kind: "page", value: 0 }, { kind: "page", value: "3" }, { kind: "cursor", value: "next page" }, { kind: "row", value: 4 }, "page=3"]) {
    const stamped = webAutomationExtractListAnswered(PARAMETERS, answer({ ...SUMMARY, place })) as JsonObject;
    assert.equal(Object.hasOwn(stamped, "place"), false, JSON.stringify(place));
    assert.equal(typeof stamped.listKey, "string");
  }
});

test("a read that names no list, and an answer that is no object, are handed back as they came", () => {
  const whole = answer(SUMMARY);
  assert.equal(webAutomationExtractListAnswered({ extractList: { handle: "extraction.1" } }, whole), whole);
  assert.equal(webAutomationExtractListAnswered(PARAMETERS, undefined), undefined);
  assert.deepEqual(webAutomationExtractListAnswered(PARAMETERS, [1]), [1]);
});

test("the live read of a list is stamped as the saved read is, and no other node's is", () => {
  const whole = answer({ ...SUMMARY, place: { kind: "page", value: 3 } });
  const live = webListReadAnswerKeys("web.output.dom-extract_list", whole, PARAMETERS) as JsonObject;
  assert.deepEqual(live, webAutomationExtractListAnswered(PARAMETERS, whole));
  assert.equal(live.place, "page=3");
  assert.equal(webListReadAnswerKeys("web.output.dom-click", whole, PARAMETERS), whole);
});
