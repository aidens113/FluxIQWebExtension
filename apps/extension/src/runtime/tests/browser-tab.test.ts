// T1 coverage of the pure part of browser-tab.ts: which open tab a switch
// selects. Opening, switching and closing themselves need chrome.tabs, which
// this Node runner does not provide.

import assert from "node:assert/strict";
import { test } from "node:test";
import { selectTabForSwitch, type SwitchableTab } from "../browser-tab";

const tabs: SwitchableTab[] = [
  { id: 1, url: "https://example.test/" },
  { id: 2, url: "https://shop.example.test/checkout" },
  { id: 3, url: "https://shop.example.test/checkout/step-2" },
  { id: 4 }
];

test("a switch by id selects that tab", () => {
  assert.deepEqual(selectTabForSwitch(tabs, { tabId: 2 }), { id: 2, url: "https://shop.example.test/checkout" });
  assert.equal(selectTabForSwitch(tabs, { tabId: 99 }), undefined);
});

test("an id wins over a pattern, so a Flow that names a tab gets that tab", () => {
  assert.deepEqual(selectTabForSwitch(tabs, { tabId: 1, urlPattern: "checkout" }), { id: 1, url: "https://example.test/" });
});

test("a pattern matches anywhere in the URL, ignoring case, and the first match wins", () => {
  assert.equal(selectTabForSwitch(tabs, { urlPattern: "checkout" })?.id, 2);
  assert.equal(selectTabForSwitch(tabs, { urlPattern: "CHECKOUT" })?.id, 2);
  assert.equal(selectTabForSwitch(tabs, { urlPattern: "step-2" })?.id, 3);
  assert.equal(selectTabForSwitch(tabs, { urlPattern: "nothing-here" }), undefined);
});

test("without an id or a pattern nothing is selected, rather than an arbitrary tab", () => {
  assert.equal(selectTabForSwitch(tabs, {}), undefined);
  assert.equal(selectTabForSwitch(tabs, { urlPattern: "" }), undefined);
  assert.equal(selectTabForSwitch([], { urlPattern: "checkout" }), undefined);
});
