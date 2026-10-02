// A read's short account and its links written from the page's origin
// (`../shown-rows/`, t194 w48).

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webNodeReadWithRejectedRows } from "../rejected-rows";
import { webNodeReadLinks, WEB_NODE_READ_FIRST_ROWS } from "../shown-rows";

const ORIGIN = "http://127.0.0.1:56906";
const PAGE = `${ORIGIN}/scenarios/everything-store/s?k=wireless+earbuds&page=5`;
const row = (index: number) => ({ name: `Earbuds ${index}`, price: `$${20 + index}.99`, url: `${ORIGIN}/scenarios/everything-store/dp/B0${index}?ref=sr_${index}` });

function listRead(count: number, extra: JsonObject = {}): JsonObject {
  return {
    actionType: "web.dom.extract_list",
    url: PAGE,
    title: "results",
    extracted: Array.from({ length: count }, (_unused, index) => row(index)),
    extraction: { recordCount: count, pagesRead: 5, paginationStop: "control_disabled" },
    ...extra
  };
}

test("a list read keeps its account ahead of its rows: the origin once, the first rows, and where the rest are", () => {
  const read = webNodeReadWithRejectedRows(listRead(70)).read as JsonObject;
  assert.deepEqual(Object.keys(read), ["actionType", "url", "title", "origin", "firstRows", "restOfRows", "extracted", "extraction"]);
  assert.equal(read.origin, ORIGIN);
  assert.equal((read.extracted as unknown[]).length, 70);
  assert.deepEqual(read.firstRows, (read.extracted as unknown[]).slice(0, WEB_NODE_READ_FIRST_ROWS));
  assert.match(read.restOfRows as string, /all 70 kept rows/u);
  assert.match(read.restOfRows as string, /core\.recall_result/u);
  // The page's own address stays whole: it is where the origin is read from.
  assert.equal(read.url, PAGE);
});

// Core refuses an execution result whose evidence meets one object twice
// (`evidence_not_json`, its check reads a repeat as a cycle): live run 14's
// every list read was refused so, and its Flow was built without one.
test("the first rows are copies, so the read shares no object between firstRows and extracted", () => {
  const read = webNodeReadWithRejectedRows(listRead(70)).read as JsonObject;
  const first = read.firstRows as JsonObject[];
  const extracted = read.extracted as JsonObject[];
  assert.equal(first.length, WEB_NODE_READ_FIRST_ROWS);
  for (const [index, shown] of first.entries()) {
    assert.deepEqual(shown, extracted[index]);
    assert.notEqual(shown, extracted[index], `firstRows[${index}] is not the object extracted[${index}] is`);
  }
  // No object reached twice anywhere in the read, which is what Core's check walks.
  const seen = new Set<object>();
  const walk = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    assert.equal(seen.has(value), false, "an object is reached twice");
    seen.add(value);
    for (const member of Array.isArray(value) ? value : Object.values(value)) walk(member);
  };
  walk(read);
});

test("every link on the read's origin is its path from there, and reads back to the exact address", () => {
  const read = webNodeReadWithRejectedRows(listRead(4)).read as JsonObject;
  for (const [index, shown] of (read.extracted as JsonObject[]).entries()) {
    assert.equal(shown.url, `/scenarios/everything-store/dp/B0${index}?ref=sr_${index}`);
    assert.equal(`${read.origin as string}${shown.url as string}`, row(index).url);
    assert.equal(shown.name, row(index).name);
  }
});

test("a link on another origin, a protocol-relative path and a value that is no address stay as they are", () => {
  const links = webNodeReadLinks(PAGE);
  assert.equal(links.write("https://cdn.example.net/x.png"), "https://cdn.example.net/x.png");
  assert.equal(links.write("Earbuds, black"), "Earbuds, black");
  assert.equal(links.write(`${ORIGIN}//evil.example/x`), `${ORIGIN}//evil.example/x`);
  assert.equal(links.used(), false);
  assert.equal(links.write(ORIGIN), "/");
  assert.equal(links.used(), true);
  // A read with no page of its own writes nothing short and states no origin.
  const nowhere = listRead(5);
  delete nowhere.url;
  const read = webNodeReadWithRejectedRows(nowhere).read as JsonObject;
  assert.equal(read.origin, undefined);
  assert.equal((read.extracted as JsonObject[])[0]?.url, row(0).url);
});

test("a short read shows its rows as its first rows and needs no pointer to the rest", () => {
  const read = webNodeReadWithRejectedRows(listRead(2)).read as JsonObject;
  assert.deepEqual(read.firstRows, read.extracted);
  assert.equal(read.restOfRows, undefined);
  const empty = webNodeReadWithRejectedRows(listRead(0)).read as JsonObject;
  assert.equal(empty.firstRows, undefined);
  assert.equal(empty.restOfRows, undefined);
  assert.deepEqual(empty.extracted, []);
});

test("a read that is no list, and a click, are shown as they were", () => {
  const text: JsonObject = { actionType: "web.dom.extract_text", url: PAGE, extracted: `${ORIGIN}/a` };
  assert.deepEqual(webNodeReadWithRejectedRows(text).read, text);
  const click: JsonObject = { actionType: "web.dom.click", url: PAGE, message: "Element clicked." };
  assert.deepEqual(webNodeReadWithRejectedRows(click).read, click);
});
