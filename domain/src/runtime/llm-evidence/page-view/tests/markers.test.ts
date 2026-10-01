// The marker lines: region, list item, table row, and where the screen is.

import assert from "node:assert/strict";
import test from "node:test";
import { bodyLines } from "./packet-fixture";

test("a region is marked where it changes, with its frame, modal dialog and form, and [page] after one was named", () => {
  assert.deepEqual(bodyLines([
    { tag: "span", text: "Top" },
    { tag: "a", href: "https://shop.test/", name: "Home", landmark: "banner" },
    { tag: "a", href: "https://shop.test/cart", name: "Cart", landmark: "banner" },
    { tag: "input", name: "Card name", landmark: "main", form: "checkout" },
    { tag: "button", name: "Pay", frameId: 2, landmark: "main" },
    { tag: "button", name: "Accept", inDialog: "t9" },
    { tag: "span", text: "Footer" }
  ]), [
    "t1 \"Top\"",
    "[banner]",
    "t2 link \"Home\" ~/",
    "t3 link \"Cart\" ~/cart",
    "[main form checkout]",
    "t4 field \"Card name\"",
    "[frame 2 main]",
    "t5 button \"Pay\"",
    "[dialog t9]",
    "t6 button \"Accept\"",
    "[page]",
    "t7 \"Footer\""
  ]);
});

test("a list item is marked where it changes, only for a list of more than one; a table row likewise", () => {
  assert.deepEqual(bodyLines([
    { tag: "span", text: "Only", item: { index: 1, total: 1 } },
    { tag: "span", text: "First", item: { index: 1, total: 3 } },
    { tag: "button", name: "Add", item: { index: 1, total: 3 } },
    { tag: "span", text: "Second", item: { index: 2, total: 3 } },
    { tag: "td", text: "Kettle", cell: { row: 1, column: 1, header: "Item" } },
    { tag: "td", text: "$39.99", cell: { row: 1, column: 2 } },
    { tag: "td", text: "Mug", cell: { row: 2, column: 1, header: "Item" } }
  ]), [
    "t1 \"Only\"",
    "- 1/3",
    "t2 \"First\"",
    "t3 button \"Add\"",
    "- 2/3",
    "t4 \"Second\"",
    "- row 1",
    "t5 \"Kettle\" @Item",
    "t6 \"$39.99\" @c2",
    "- row 2",
    "t7 \"Mug\" @Item"
  ]);
});

test("the screen: lines start on screen, and each change of zone is marked", () => {
  const viewport = { width: 1280, height: 720, scrollX: 0, scrollY: 1000 };
  assert.deepEqual(bodyLines([
    { tag: "span", text: "Above", box: { x: 10, y: 100, width: 100, height: 20 }, onViewport: false },
    { tag: "span", text: "Here", box: { x: 10, y: 1100, width: 100, height: 20 }, onViewport: true },
    { tag: "span", text: "Aside", box: { x: 2000, y: 1100, width: 100, height: 20 }, onViewport: false },
    { tag: "span", text: "Below", box: { x: 10, y: 3000, width: 100, height: 20 }, onViewport: false },
    { tag: "span", text: "Back", box: { x: 10, y: 1200, width: 100, height: 20 }, onViewport: true }
  ], { viewport }), [
    "--- above the screen ---", "t1 \"Above\"",
    "--- on screen ---", "t2 \"Here\"",
    "--- off screen ---", "t3 \"Aside\"",
    "--- below the fold ---", "t4 \"Below\"",
    "--- on screen ---", "t5 \"Back\""
  ]);
});

test("without a viewport, a line the capture said is off screen reads as below", () => {
  assert.deepEqual(bodyLines([
    { tag: "span", text: "Here" },
    { tag: "span", text: "Later", onViewport: false }
  ]), ["t1 \"Here\"", "--- below the fold ---", "t2 \"Later\""]);
});
