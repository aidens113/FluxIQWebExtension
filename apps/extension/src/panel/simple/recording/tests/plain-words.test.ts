// Simple Mode never shows a selector, an XPath, an id or a URL: text that looks
// like one is dropped, and human names pass through, collapsed and cut.

import assert from "node:assert/strict";
import test from "node:test";
import { plainWords } from "../plain-words";

test("human names pass through with their whitespace collapsed", () => {
  assert.equal(plainWords("  Add   to\ncart "), "Add to cart");
  assert.equal(plainWords("Search"), "Search");
  assert.equal(plainWords("Size: Large"), "Size: Large");
  assert.equal(plainWords("Log in to your account"), "Log in to your account");
});

test("selectors, XPaths, ids and URLs are dropped", () => {
  for (const technical of [
    "#submit",
    ".btn-primary",
    "button.primary",
    "div#main > a",
    "form input[name=email]",
    "//div[@id='x']",
    "ul li:nth-child(2)",
    "add-to-cart",
    "btn_submit",
    "node42abc",
    "dom.click.1727000000",
    "3f2a9c1e-7b1d-4c2a-9e10-1234567890ab",
    "https://shop.example.com/cart"
  ]) {
    assert.equal(plainWords(technical), undefined, technical);
  }
});

test("empty and non-text values are undefined, and long text is cut", () => {
  assert.equal(plainWords(""), undefined);
  assert.equal(plainWords("   "), undefined);
  assert.equal(plainWords(42), undefined);
  assert.equal(plainWords(undefined), undefined);
  assert.equal(plainWords({ label: "Search" }), undefined);
  const cut = plainWords("A very long button name that keeps going", 20);
  assert.equal(cut, "A very long butto...");
  assert.ok((cut ?? "").length <= 20);
});
