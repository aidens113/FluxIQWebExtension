// T1 coverage of navigation-outcome.ts: the post-condition that decides whether
// a navigation arrived where it was sent. A site's own rewriting of its address
// is the same destination; a redirect somewhere else is not, which is the case
// the plan cares about (an auth wall, a consent page, an error page).

import assert from "node:assert/strict";
import { test } from "node:test";
import { compareNavigatedUrl } from "../navigation-outcome";

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
