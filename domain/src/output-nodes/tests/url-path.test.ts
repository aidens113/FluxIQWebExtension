// The exact-pathname rule a recorded tab switch and a child frame are named by,
// and the one the extension's readers of `frameUrlPath` import.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationUrlPath as fromBarrel } from "..";
import { webAutomationUrlPath } from "../url-path";

test("an exact pathname is itself", () => {
  for (const path of ["/", "/scenarios/multi-tab/details", "/scenarios/iframe-checkout/payment", "/a%3Fb%23c"]) {
    assert.equal(webAutomationUrlPath(path), path, path);
  }
});

test("a full URL, a query, a fragment, a relative path or a non-string is no path, and is never trimmed into one", () => {
  for (const value of ["http://127.0.0.1:4173/list", "https://example.test/", "//example.test/list", "/\\example.test/list", "/list?session=tok-123", "/list#top", "/list?", "list", "", 7, null, undefined, { path: "/list" }]) {
    assert.equal(webAutomationUrlPath(value), undefined, JSON.stringify(value) ?? "undefined");
  }
});

test("the output-nodes barrel exports the rule, so the client barrel re-exports it", () => {
  assert.equal(fromBarrel, webAutomationUrlPath);
});
