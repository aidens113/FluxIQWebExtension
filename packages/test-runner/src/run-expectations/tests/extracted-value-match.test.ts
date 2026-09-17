import assert from "node:assert/strict";
import test from "node:test";
import { extractedValueMatches } from "../extracted-value-match.js";

const run = { scenarioOrigin: "http://127.0.0.1:4100" };
const expectedHref = "/scenarios/product-catalog/products/desk-lamp";

test("an absolute URL on the run's scenario origin equals the root-relative value an expectation holds", () => {
  assert.equal(extractedValueMatches(expectedHref, `http://127.0.0.1:4100${expectedHref}`, run), true);
  // Compared after normal URL parsing, so a spelling the parser normalises still matches.
  assert.equal(extractedValueMatches(expectedHref, `HTTP://127.0.0.1:4100${expectedHref}`, run), true);
  assert.equal(extractedValueMatches("/scenarios/a b", "http://127.0.0.1:4100/scenarios/a%20b", run), true);
  // The origin is the run's, however the caller spelled it.
  assert.equal(extractedValueMatches(expectedHref, `http://127.0.0.1:4100${expectedHref}`, { scenarioOrigin: "http://127.0.0.1:4100/scenarios/product-catalog/" }), true);
});

test("the resolved URL must be the same URL, not merely a URL on the same origin", () => {
  assert.equal(extractedValueMatches(expectedHref, "http://127.0.0.1:4100/scenarios/product-catalog/products/desk", run), false);
  assert.equal(extractedValueMatches(expectedHref, `http://127.0.0.1:4100${expectedHref}/`, run), false);
  assert.equal(extractedValueMatches(expectedHref, `http://127.0.0.1:4100${expectedHref}?page=1`, run), false);
  assert.equal(extractedValueMatches(expectedHref, `http://127.0.0.1:4100${expectedHref}#top`, run), false);
});

test("another origin never matches: another host, another port, another scheme", () => {
  assert.equal(extractedValueMatches(expectedHref, `https://catalog.example.test${expectedHref}`, run), false);
  assert.equal(extractedValueMatches(expectedHref, `http://127.0.0.1:4101${expectedHref}`, run), false, "a previous run's port is another origin");
  assert.equal(extractedValueMatches(expectedHref, `http://localhost:4100${expectedHref}`, run), false);
  assert.equal(extractedValueMatches(expectedHref, `https://127.0.0.1:4100${expectedHref}`, run), false);
});

test("only a single leading slash is root-relative: a value the parser would resolve onto another host is not", () => {
  // Protocol-relative: names a host of its own.
  assert.equal(extractedValueMatches("//catalog.example.test/products/desk-lamp", "http://catalog.example.test/products/desk-lamp", run), false);
  assert.equal(extractedValueMatches("//127.0.0.1:4100/products/desk-lamp", "http://127.0.0.1:4100/products/desk-lamp", run), false);
  // A backslash reads as a slash in a special scheme, so this resolves onto evil.test.
  assert.equal(extractedValueMatches("/\\evil.test/products", "http://evil.test/products", run), false);
});

test("an expected absolute URL compares exactly, as it always has", () => {
  const absolute = `https://catalog.example.test${expectedHref}`;
  assert.equal(extractedValueMatches(absolute, absolute, run), true);
  assert.equal(extractedValueMatches(absolute, `http://127.0.0.1:4100${expectedHref}`, run), false);
  assert.equal(extractedValueMatches(absolute, expectedHref, run), false);
  assert.equal(extractedValueMatches(`http://127.0.0.1:4100${expectedHref}`, `HTTP://127.0.0.1:4100${expectedHref}`, run), false, "only a root-relative expectation is parsed");
});

test("an observed value that is not an absolute URL compares exactly", () => {
  assert.equal(extractedValueMatches(expectedHref, expectedHref, run), true);
  assert.equal(extractedValueMatches(expectedHref, "scenarios/product-catalog/products/desk-lamp", run), false);
  assert.equal(extractedValueMatches(expectedHref, "/scenarios/product-catalog/./products/desk-lamp", run), false, "a relative observed value is never resolved");
  assert.equal(extractedValueMatches(expectedHref, "", run), false);
});

test("text the URL parser would quietly strip is a difference, as it is in any other field", () => {
  assert.equal(extractedValueMatches(expectedHref, ` http://127.0.0.1:4100${expectedHref}`, run), false);
  assert.equal(extractedValueMatches(expectedHref, `http://127.0.0.1:4100${expectedHref}\n`, run), false);
  assert.equal(extractedValueMatches(expectedHref, "http://127.0.0.1:4100/scenarios/product-catalog/products/desk-\nlamp", run), false);
  assert.equal(extractedValueMatches(`${expectedHref}\t`, `http://127.0.0.1:4100${expectedHref}`, run), false);
});

test("strings that are not URLs, and null, compare exactly", () => {
  assert.equal(extractedValueMatches("$25.00", "$25.00", run), true);
  assert.equal(extractedValueMatches("$25.00", "25.00 USD", run), false);
  assert.equal(extractedValueMatches("4.5 out of 5", "4.5 out of 5 ", run), false);
  assert.equal(extractedValueMatches(null, null, run), true);
  assert.equal(extractedValueMatches(null, "", run), false);
  assert.equal(extractedValueMatches(expectedHref, null, run), false);
  assert.equal(extractedValueMatches(null, `http://127.0.0.1:4100${expectedHref}`, run), false);
});

test("with no scenario origin, or one that names no web origin, every value compares exactly", () => {
  const observed = `http://127.0.0.1:4100${expectedHref}`;
  assert.equal(extractedValueMatches(expectedHref, observed, undefined), false);
  assert.equal(extractedValueMatches(expectedHref, expectedHref, undefined), true);
  assert.equal(extractedValueMatches(expectedHref, observed, { scenarioOrigin: "127.0.0.1:4100" }), false);
  assert.equal(extractedValueMatches(expectedHref, observed, { scenarioOrigin: "" }), false);
  assert.equal(extractedValueMatches(expectedHref, `file://${expectedHref}`, { scenarioOrigin: "file:///" }), false, "an opaque origin is no origin");
});
