// Coverage of `droppedQueryState`: which parameters of a page's own address,
// shown applied by a control on the page, a control's address leaves out --
// compared generically, with no parameter known by name.

import assert from "node:assert/strict";
import test from "node:test";
import type { AppliedControl } from "../applied-controls";
import { droppedQueryState } from "../dropped-state";

const at = (query: string): URL => new URL(`http://library.test/catalog?${query}`);
const shown = (name: string | undefined, value: string | undefined): AppliedControl => ({ name, value });
/** A rail showing an e-book format checked and English selected, by name and by value. */
const RAIL: AppliedControl[] = [shown("format", "ebook"), shown(undefined, "en")];

test("an address that keeps every parameter, the page number changed, drops nothing", () => {
  assert.equal(droppedQueryState(at("term=x&format=ebook&p=3"), at("term=x&format=ebook&p=2"), 2, RAIL), 0);
});

test("an address that adds the page number on a first page drops nothing", () => {
  assert.equal(droppedQueryState(at("term=x&format=ebook&p=2"), at("format=ebook&term=x"), 1, RAIL), 0);
});

test("an address that leaves out a parameter the page shows applied drops it, and each one counts", () => {
  assert.equal(droppedQueryState(at("term=x&p=2"), at("term=x&format=ebook"), 1, RAIL), 1);
  assert.equal(droppedQueryState(at("term=x&p=2"), at("term=x&format=ebook&lang=en"), 1, RAIL), 2);
});

test("a dropped parameter nothing on the page shows applied is not the list's scope: a tracking tag", () => {
  assert.equal(droppedQueryState(at("term=x&format=ebook&p=2"), at("term=x&format=ebook&ref=newsletter"), 1, RAIL), 0);
  assert.equal(droppedQueryState(at("term=x&p=2"), at("term=x&format=ebook"), 1, []), 0, "a page that shows nothing applied loses nothing it shows");
});

test("an address that leaves out one value of a parameter the page carries twice drops it", () => {
  const both = [shown("lang", "en"), shown("lang", "fr")];
  assert.equal(droppedQueryState(at("term=x&lang=en&p=2"), at("term=x&lang=en&lang=fr"), 1, both), 1);
  assert.equal(droppedQueryState(at("lang=fr&term=x&lang=en&p=2"), at("term=x&lang=en&lang=fr"), 1, both), 0);
});

test("a control's value that is a whole part of a parameter's joined value shows it applied", () => {
  const joined = at("term=x&f=seller%3AOakmere%7C%7Cshipping%3AFree");
  assert.equal(droppedQueryState(at("term=x&p=2"), joined, 1, [shown(undefined, "shipping:Free")]), 1);
  assert.equal(droppedQueryState(at("term=x&p=2"), joined, 1, [shown(undefined, "SELLER:oakmere")]), 1, "compared without case");
  assert.equal(droppedQueryState(at("term=x&p=2"), joined, 1, [shown(undefined, "mere")]), 0, "a part is bounded by what is not a letter or digit");
});

test("a short value must be the parameter's whole value, so a radio worth 1 is not read inside a tag", () => {
  assert.equal(droppedQueryState(at("term=x&p=2"), at("term=x&ref=sr_pg_1"), 1, [shown("rating", "1")]), 0);
  assert.equal(droppedQueryState(at("term=x&p=3"), at("term=x&rating=1&p=2"), 2, [shown(undefined, "1")]), 1);
});

test("a changed value is paging, not a drop: an opaque cursor moves from page to page", () => {
  assert.equal(droppedQueryState(at("term=x&cursor=b7f"), at("term=x&cursor=a91"), undefined, [shown("cursor", "a91")]), 0);
});

test("an empty parameter narrows nothing, and the one holding the current page number may be renamed", () => {
  assert.equal(droppedQueryState(at("term=x&p=2"), at("term=x&format="), 1, [shown("format", "ebook")]), 0);
  assert.equal(droppedQueryState(at("term=x&offset=40"), at("term=x&page=2"), 2, [shown("page", "2")]), 0);
  assert.equal(droppedQueryState(at("term=x&offset=40"), at("term=x&page=2"), undefined, [shown("page", "2")]), 1, "with no current page marked, nothing says the parameter is the page");
});
