// What a Next page step says of the list it moved, for Core's paging (t1013): the list by the same `listKey` its read
// carries, the verdict, this domain's words for an end, and the page the pager marked.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationExtractListAnswered } from "../../extract-list";
import { webAutomationNextPageListMove } from "../list-move";

const ITEM = "li.departure";
const READ: JsonObject = { extractList: { item: ITEM, fields: { train: ".train" } }, browserFrameId: 2, browserFrameUrlPath: "/board" };
const NEXT: JsonObject = { nextPage: { item: ITEM, pagination: { next: "a.later" } }, browserFrameId: 2, browserFrameUrlPath: "/board" };
const readKey = (parameters: JsonObject) => (webAutomationExtractListAnswered(parameters, { extracted: [] } as JsonObject) as JsonObject).listKey;

test("the move names the list by the listKey a read of the same list carries", () => {
  const move = webAutomationNextPageListMove(NEXT, { nextPage: { outcome: "moved", by: "next" } });
  assert.equal(typeof move?.listKey, "string");
  assert.equal(move?.listKey, readKey(READ));
  assert.deepEqual(move, { listKey: readKey(READ), verdict: "moved", said: "the list moved to its next page" });
});

test("another list, or the same list in another frame, is another key", () => {
  const other = webAutomationNextPageListMove({ ...NEXT, nextPage: { item: "li.arrival" } }, { nextPage: { outcome: "moved", by: "next" } });
  const elsewhere = webAutomationNextPageListMove({ ...NEXT, browserFrameUrlPath: "/other" }, { nextPage: { outcome: "moved", by: "next" } });
  assert.notEqual(other?.listKey, readKey(READ));
  assert.notEqual(elsewhere?.listKey, readKey(READ));
});

test("an end says why in this domain's words, and the page it was seen on where the pager marks one", () => {
  for (const [stop, said] of [
    ["control_absent", "no control to its next page shows on the list's own page"],
    ["control_disabled", "its control to the next page is disabled on the list's own page"],
    ["no_following_page", "its pager shows no page after this one"],
    ["scrolled_to_end", "scrolling to its end on its own page loaded no more of it"]
  ] as const) {
    assert.deepEqual(webAutomationNextPageListMove(NEXT, { nextPage: { outcome: "ended", stop } }), { listKey: readKey(READ), verdict: "ended", said });
  }
  assert.equal(webAutomationNextPageListMove(NEXT, { nextPage: { outcome: "ended", stop: "control_disabled", page: 4 } })?.place, "page=4");
  assert.deepEqual(webAutomationNextPageListMove(NEXT, { nextPage: { outcome: "moved", by: "numbered", page: 3 } }), { listKey: readKey(READ), verdict: "moved", said: "the list moved to page=3", place: "page=3" });
});

test("a failed move, an answer that is not one, or a request naming no list says nothing", () => {
  assert.equal(webAutomationNextPageListMove(NEXT, { nextPage: { outcome: "failed", stop: "list_vanished" } }), undefined);
  assert.equal(webAutomationNextPageListMove(NEXT, { nextPage: { outcome: "ended", stop: "page_limit" } }), undefined);
  assert.equal(webAutomationNextPageListMove(NEXT, undefined), undefined);
  assert.equal(webAutomationNextPageListMove({ nextPage: { list: "extraction.1" } }, { nextPage: { outcome: "moved", by: "next" } }), undefined);
  assert.equal(webAutomationNextPageListMove({}, { nextPage: { outcome: "moved", by: "next" } }), undefined);
});
