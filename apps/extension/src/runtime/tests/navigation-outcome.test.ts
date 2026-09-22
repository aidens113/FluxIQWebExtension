// T1 coverage of navigation-outcome.ts: the post-condition that decides whether
// a navigation arrived where it was sent, and whether it was any work at all.
//
// A site's own rewriting of its address is the same destination; a redirect
// somewhere else is not, which is the case the plan cares about (an auth wall,
// a consent page, an error page). The second half is the case the destination
// check cannot see: a navigation to the page the tab already shows arrives by
// definition, so "did the browser do anything?" is a separate question with a
// separate answer, and it must say "I could not tell" rather than "no" when
// the record does not hold the evidence.

import assert from "node:assert/strict";
import { test } from "node:test";
import { compareNavigatedUrl, judgeTabMovement } from "../navigation-outcome";
import type { TabDriveRecord } from "../automation-tab";

test("the same URL, and the rewrites a site performs on its own address, match", () => {
  const same: Array<[string, string]> = [
    ["https://example.test/checkout", "https://example.test/checkout"],
    ["https://example.test/checkout", "https://example.test/checkout/"],
    ["https://example.test/checkout", "https://example.test/checkout#summary"],
    ["http://example.test/checkout", "https://example.test/checkout"],
    ["https://example.test/checkout", "https://www.example.test/checkout"],
    ["https://EXAMPLE.test/checkout", "https://example.test/checkout"],
    ["https://example.test", "https://example.test/"]
  ];
  for (const [requested, landed] of same) {
    const comparison = compareNavigatedUrl(requested, landed);
    assert.equal(comparison.matched, true, `${requested} -> ${landed}`);
    assert.equal(comparison.expected, requested);
    assert.equal(comparison.actual, landed);
  }
});

test("a different host or path is a different destination", () => {
  const different: Array<[string, string]> = [
    ["https://example.test/dashboard", "https://example.test/login"],
    ["https://example.test/checkout", "https://other.test/checkout"],
    ["https://example.test/checkout", "https://example.test/checkout/step-2"],
    ["https://example.test/checkout", "https://example.test:8443/checkout"]
  ];
  for (const [requested, landed] of different) {
    const comparison = compareNavigatedUrl(requested, landed);
    assert.equal(comparison.matched, false, `${requested} -> ${landed}`);
    assert.equal(comparison.expected, requested);
    assert.equal(comparison.actual, landed);
  }
});

test("a query is compared only when the request carried one", () => {
  // Tracking parameters a site appends must not fail an action that never asked
  // about them; a query the request did name is part of the destination.
  assert.equal(compareNavigatedUrl("https://example.test/search", "https://example.test/search?utm=ad").matched, true);
  assert.equal(compareNavigatedUrl("https://example.test/search?q=lamp", "https://example.test/search?q=lamp").matched, true);
  assert.equal(compareNavigatedUrl("https://example.test/search?q=lamp", "https://example.test/search?q=chair").matched, false);
  assert.equal(compareNavigatedUrl("https://example.test/search?q=lamp", "https://example.test/search").matched, false);
});

test("a URL the worker could not read is not proof of arrival", () => {
  for (const landed of [undefined, "", "   "]) {
    const comparison = compareNavigatedUrl("https://example.test/", landed);
    assert.equal(comparison.matched, false, String(landed));
    assert.equal(comparison.actual, "(unknown)");
  }
});

test("an unparseable URL matches only itself", () => {
  assert.equal(compareNavigatedUrl("not a url", "not a url").matched, true);
  assert.equal(compareNavigatedUrl("not a url", "https://example.test/").matched, false);
});

test("a non-web scheme must match exactly", () => {
  assert.equal(compareNavigatedUrl("file:///tmp/report.html", "file:///tmp/report.html").matched, true);
  assert.equal(compareNavigatedUrl("https://example.test/", "file:///tmp/report.html").matched, false);
});

// Chrome keeps the requested URL in the address bar when it shows its own error
// page -- a refused connection, an unknown host -- so the address matches and
// only the browser's word that the load failed tells the two apart.
test("an address that matches is still not an arrival when the browser could not load the page", () => {
  const comparison = compareNavigatedUrl("http://127.0.0.1:64130/s?k=earbuds", "http://127.0.0.1:64130/s?k=earbuds", true);
  assert.deepEqual(comparison, {
    matched: false,
    expected: "http://127.0.0.1:64130/s?k=earbuds",
    actual: "the browser could not load http://127.0.0.1:64130/s?k=earbuds"
  });
});

/** A drive record with the fields a row is about, and the rest as a settled tab would report them. */
function drive(fields: Partial<TabDriveRecord>): TabDriveRecord {
  return { opened: false, reloaded: false, ...fields };
}

test("a tab that kept both its address and its document did nothing", () => {
  const stayed = judgeTabMovement(drive({
    urlBefore: "https://example.test/store",
    urlAfter: "https://example.test/store",
    documentBefore: "document.one",
    documentAfter: "document.one",
    reloaded: true
  }));
  assert.equal(stayed.moved, false);
  assert.equal(stayed.known, true);
  assert.match(stayed.detail, /did not load the page again/u);
});

test("a document the browser replaced is work, and a reload says so in its own words", () => {
  const reloaded = judgeTabMovement(drive({
    urlBefore: "https://example.test/store",
    urlAfter: "https://example.test/store",
    documentBefore: "document.one",
    documentAfter: "document.two",
    reloaded: true
  }));
  assert.equal(reloaded.moved, true);
  assert.match(reloaded.detail, /loaded the page again/u);

  const replaced = judgeTabMovement(drive({ documentBefore: "document.one", documentAfter: "document.two" }));
  assert.equal(replaced.moved, true);
  assert.match(replaced.detail, /loaded a new document/u);
});

test("an address that moved is work even when the document did not: a same-document navigation", () => {
  const moved = judgeTabMovement(drive({
    urlBefore: "https://example.test/store",
    urlAfter: "https://example.test/store#offers",
    documentBefore: "document.one",
    documentAfter: "document.one"
  }));
  assert.equal(moved.moved, true);
  assert.equal(moved.known, true);
  assert.match(moved.detail, /moved from https:\/\/example\.test\/store/u);
});

test("a tab opened for the navigation is work by construction", () => {
  const opened = judgeTabMovement(drive({ opened: true, urlAfter: "https://example.test/store", documentAfter: "document.one" }));
  assert.equal(opened.moved, true);
  assert.equal(opened.known, true);
});

test("evidence the browser would not give is unknown, never a no-op", () => {
  const rows: Array<[string, TabDriveRecord | undefined]> = [
    ["no drive was made at all", undefined],
    ["no document before", drive({ urlBefore: "https://example.test/store", urlAfter: "https://example.test/store", documentAfter: "document.one" })],
    ["no document after", drive({ urlBefore: "https://example.test/store", urlAfter: "https://example.test/store", documentBefore: "document.one" })]
  ];
  for (const [label, record] of rows) {
    const judged = judgeTabMovement(record);
    assert.equal(judged.moved, true, label);
    assert.equal(judged.known, false, label);
  }
});
