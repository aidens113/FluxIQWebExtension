// `web.dom.next_page`'s request (contract C1): the list's item selector, the
// element it was picked from, and the way to the next page as detected or
// named. One step moves one page, so a bound of any kind is refused rather than
// dropped: a request carrying `maxPages` was written for a read, not for this.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationNextPageRequestValue } from "../request-value";

test("each of the four ways to the next page is read as written", () => {
  const rows: JsonObject[] = [
    { item: "li.result", pagination: { next: "a.next" } },
    { item: "li.result", pagination: { mode: "next", next: "a.next" } },
    { item: "li.result", pagination: { mode: "loadMore", control: "button.more" } },
    { item: "li.result", pagination: { mode: "scroll" } },
    { item: "li.result", pagination: { mode: "numbered", pages: "nav.pager a" } }
  ];
  for (const row of rows) assert.deepEqual(webAutomationNextPageRequestValue(row), row, JSON.stringify(row));
});

test("a request with no way is found live from the list", () => {
  assert.deepEqual(webAutomationNextPageRequestValue({ item: "li.result" }), { item: "li.result" });
});

test("the item's element is kept as the one fingerprint normalizer describes it", () => {
  const read = webAutomationNextPageRequestValue({ item: "li.result", itemElement: { selector: "li.result", tagName: "li", testId: "result" } });
  assert.equal(read?.item, "li.result");
  assert.equal(read?.itemElement?.testId, "result");
});

test("a bound of any kind is refused: one step moves one page", () => {
  for (const request of [
    { item: "li.result", maxPages: 3 },
    { item: "li.result", pagination: { next: "a.next", maxPages: 3 } },
    { item: "li.result", pagination: { mode: "loadMore", control: "button.more", maxPages: 2 } },
    { item: "li.result", pagination: { mode: "scroll", maxScrolls: 5 } },
    { item: "li.result", pagination: { mode: "numbered", pages: "nav a", maxPages: 4 } }
  ] as JsonObject[]) {
    assert.equal(webAutomationNextPageRequestValue(request), undefined, JSON.stringify(request));
  }
});

test("an unknown key, here or in the way, is refused", () => {
  assert.equal(webAutomationNextPageRequestValue({ item: "li.result", fields: { name: ".name" } }), undefined);
  assert.equal(webAutomationNextPageRequestValue({ item: "li.result", list: "extraction.1" }), undefined);
  assert.equal(webAutomationNextPageRequestValue({ item: "li.result", pagination: { next: "a.next", control: "button.more" } }), undefined);
  assert.equal(webAutomationNextPageRequestValue({ item: "li.result", pagination: { mode: "scroll", next: "a.next" } }), undefined);
});

test("an empty selector or an unknown mode is refused", () => {
  for (const request of [
    {},
    { item: "" },
    { item: "   " },
    { item: 3 },
    { item: "li.result", pagination: { next: "" } },
    { item: "li.result", pagination: { mode: "loadMore", control: " " } },
    { item: "li.result", pagination: { mode: "numbered" } },
    { item: "li.result", pagination: { mode: "infinite" } },
    { item: "li.result", pagination: "a.next" },
    { item: "li.result", itemElement: "li.result" }
  ] as unknown as JsonObject[]) {
    assert.equal(webAutomationNextPageRequestValue(request), undefined, JSON.stringify(request));
  }
  for (const value of [undefined, null, "li.result", ["li.result"]]) assert.equal(webAutomationNextPageRequestValue(value), undefined);
});
