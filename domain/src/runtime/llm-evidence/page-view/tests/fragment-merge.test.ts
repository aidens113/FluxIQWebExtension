// F4: a run of letterless text lines becomes one line for the element that
// holds them, when that element has no line, holds no control, and holds no
// other line. Otherwise the run stays.

import assert from "node:assert/strict";
import test from "node:test";
import { bodyLines, type FixtureElement } from "./packet-fixture";

/** A price drawn as three spans under one holder, after a line that says something else. */
function price(holder: FixtureElement, extra: FixtureElement[] = []): FixtureElement[] {
  return [
    { tag: "span", text: "Typical:" },
    holder,
    { tag: "span", text: "$", parent: "t2" },
    { tag: "span", text: "39.", parent: "t2" },
    { tag: "span", text: "99", parent: "t2" },
    ...extra
  ];
}

test("the fragments of a price become one line for their holder", () => {
  assert.deepEqual(bodyLines(price({ tag: "span" })), ["t1 \"Typical:\"", "t2 \"$39.99\""]);
});

test("the joined line takes its holder's kind and state", () => {
  assert.deepEqual(bodyLines(price({ tag: "td", text: "$39.99", ownText: "", cell: { row: 1, column: 2, header: "Price" } })), [
    "t1 \"Typical:\"", "- row 1", "t2 \"$39.99\" @Price"
  ]);
});

test("a holder with a line of its own keeps the run as it is", () => {
  assert.deepEqual(bodyLines(price({ tag: "div", text: "Now", ownText: "Now" })), ["t1 \"Typical:\"", "t2 \"Now\"", "t3 \"$\"", "t4 \"39.\"", "t5 \"99\""]);
});

test("a holder that holds a control keeps the run as it is", () => {
  assert.deepEqual(bodyLines(price({ tag: "div" }, [{ tag: "button", name: "Add", parent: "t2" }])), [
    "t1 \"Typical:\"", "t3 \"$\"", "t4 \"39.\"", "t5 \"99\"", "t6 button \"Add\""
  ]);
});

test("a holder with another line under it keeps the run as it is", () => {
  assert.deepEqual(bodyLines(price({ tag: "div" }, [{ tag: "span", text: "per kettle", parent: "t2" }])), [
    "t1 \"Typical:\"", "t3 \"$\"", "t4 \"39.\"", "t5 \"99\"", "t6 \"per kettle\""
  ]);
});

test("a folded screen-reader copy under the holder does not stop the join, and the joined price is then folded as a repeat", () => {
  assert.deepEqual(bodyLines([
    { tag: "a", href: "https://shop.test/store/item", name: "$39.99" },
    { tag: "span" },
    { tag: "span", text: "$39.99", parent: "t2" },
    { tag: "span", text: "$", parent: "t2" },
    { tag: "span", text: "39.", parent: "t2" },
    { tag: "span", text: "99", parent: "t2" }
  ]), ["t1 link \"$39.99\" ~/item"], "the price once: no `$`, `39.` or `99` fragments");
});

test("one fragment alone is not a run, and without parent no run joins", () => {
  assert.deepEqual(bodyLines([{ tag: "span", text: "Rating" }, { tag: "span", text: "4.5" }]), ["t1 \"Rating\"", "t2 \"4.5\""]);
  assert.deepEqual(bodyLines([{ tag: "span", text: "$" }, { tag: "span", text: "39." }, { tag: "span", text: "99" }]), ["t1 \"$\"", "t2 \"39.\"", "t3 \"99\""]);
});

test("a quantity stepper drawn as plain spans keeps its minus and plus as lines of their own, each with its handle", () => {
  // bigbox's stepper: `−`, `1`, `+` under one holder. Joined, it read `− 1 +`
  // on the holder and the plus had no handle a press could name (run 39).
  assert.deepEqual(bodyLines([
    { tag: "div" },
    { tag: "span", text: "−", parent: "t1" },
    { tag: "span", text: "1", parent: "t1" },
    { tag: "span", text: "+", parent: "t1" }
  ]), ["t2 \"−\"", "t3 \"1\"", "t4 \"+\""]);
});
