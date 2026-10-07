// Which list a list read read, as the code its draft statement sends Core
// (`reads`). That a read carries it, and a press does not, is run end to end in
// `../../tests/run.test.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webListReadCode } from "..";

const EXTRACT = "web.output.dom-extract_list";
const PAGE_ONE = "https://shop.test/search?q=earbuds&page=1";
/** What Core keeps: anything else is dropped silently. */
const CORE_PATTERN = /^[a-z0-9_.:-]{1,100}$/iu;

const read = (item: string, extra: JsonObject = {}): JsonObject => ({ extractList: { item, fields: { name: { selector: ".name" } }, ...extra } });

test("the code is the page's origin and path and the resolved list, in a shape Core keeps", () => {
  const code = webListReadCode(EXTRACT, PAGE_ONE, read(".card"));
  assert.match(String(code), CORE_PATTERN);
  // Query, hash, columns, conditions, order and paging do not make another list.
  assert.equal(code, webListReadCode(EXTRACT, "https://shop.test/search?q=earbuds&page=5#top", read(".card", { sort: [{ field: "name" }], where: [{ field: "name", contains: ["pro"] }], paginate: true })));
  // Another list, path or origin does.
  assert.notEqual(code, webListReadCode(EXTRACT, PAGE_ONE, read(".row")));
  assert.notEqual(code, webListReadCode(EXTRACT, "https://shop.test/deals", read(".card")));
  assert.notEqual(code, webListReadCode(EXTRACT, "https://other.test/search", read(".card")));
});

test("no list identity, no page, or no list read: no code", () => {
  assert.equal(webListReadCode(EXTRACT, PAGE_ONE, { extractList: { handle: "extraction.1" } }), undefined);
  assert.equal(webListReadCode(EXTRACT, PAGE_ONE, {}), undefined);
  assert.equal(webListReadCode(EXTRACT, undefined, read(".card")), undefined);
  assert.equal(webListReadCode(EXTRACT, "not a url", read(".card")), undefined);
  assert.equal(webListReadCode(EXTRACT, "about:blank", read(".card")), undefined);
  assert.equal(webListReadCode("web.output.dom-click", PAGE_ONE, read(".card")), undefined);
});
