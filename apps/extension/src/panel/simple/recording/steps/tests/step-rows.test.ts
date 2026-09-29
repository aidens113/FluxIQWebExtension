// The recording log as steps: only the person's own actions, in plain words,
// newest first, never a selector, a URL or an id; anything unreadable skipped.

import assert from "node:assert/strict";
import test from "node:test";
import { stepRows } from "../step-rows";

const reply = (items: unknown) => ({ ok: true, log: { items, page: 1, pageSize: 5, total: 9 } });

test("actions become verb and name, in the log's newest-first order", () => {
  const rows = stepRows(reply([
    { id: "a", timestamp: 3, kind: "dom.click", label: "Click", detail: "Add to cart" },
    { id: "b", timestamp: 2, kind: "dom.input", label: "Input changed", detail: "Email" },
    { id: "c", timestamp: 1, kind: "browser.navigation", label: "Navigation", detail: "https://shop.example.com/cart?x=1" },
    { id: "d", timestamp: 0, kind: "dom.keydown", label: "Key Enter" }
  ]));
  assert.deepEqual(rows, [
    { id: "a", label: "Clicked", detail: "\"Add to cart\"" },
    { id: "b", label: "Typed into", detail: "\"Email\"" },
    { id: "c", label: "Opened a page", detail: "shop.example.com" },
    { id: "d", label: "Pressed Enter" }
  ]);
});

test("a selector detail is never shown: the step falls back to words without a name", () => {
  const rows = stepRows(reply([
    { id: "a", timestamp: 1, kind: "dom.click", label: "Click", detail: "#checkout > button.primary" },
    { id: "b", timestamp: 1, kind: "dom.change", label: "Field changed", detail: "select[name=size]" },
    { id: "c", timestamp: 1, kind: "dom.scroll", label: "Page scrolled", detail: "0, 480" }
  ]));
  assert.deepEqual(rows, [
    { id: "a", label: "Clicked something" },
    { id: "b", label: "Changed a field" },
    { id: "c", label: "Scrolled the page" }
  ]);
  for (const row of rows) assert.ok(!JSON.stringify(row).includes("#checkout") && !JSON.stringify(row).includes("select["));
});

test("connection notes, snapshots, page changes and evidence copies are not steps", () => {
  const rows = stepRows(reply([
    { id: "a", timestamp: 1, kind: "recording", label: "Recording started", detail: "https://x.example" },
    { id: "b", timestamp: 1, kind: "snapshot", label: "Snapshot captured" },
    { id: "c", timestamp: 1, kind: "dom.mutation", label: "DOM changed", detail: "3 added, 0 removed" },
    { id: "d", timestamp: 1, kind: "dom.click", label: "Evidence: Click", detail: "Buy" },
    { id: "e", timestamp: 1, kind: "connection", label: "Disconnected during recording" }
  ]));
  assert.deepEqual(rows, []);
});

test("an unreadable reply or entry is skipped rather than trusted", () => {
  assert.deepEqual(stepRows(undefined), []);
  assert.deepEqual(stepRows({ ok: true }), []);
  assert.deepEqual(stepRows({ ok: true, log: { items: "nope" } }), []);
  assert.deepEqual(stepRows(reply([null, 7, { kind: "dom.click" }, { id: "", kind: "dom.click" }, { id: "x", kind: 3 }])), []);
});
