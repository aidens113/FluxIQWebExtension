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

test("a price printed once for a screen reader and again in pieces for the eye prints once", () => {
  // bigbox's tile: `<span>$10.47</span><span aria-hidden>$10<sup>47</sup></span>`
  // and a unit price under the same block (lane B's bigbox run, 2026-10-01).
  assert.deepEqual(bodyLines([
    { tag: "div" },
    { tag: "span", text: "$10.47", parent: "t1" },
    { tag: "span", text: "$1047", ownText: "$10", parent: "t1" },
    { tag: "sup", text: "47", parent: "t3" },
    { tag: "span", text: "1.4 ¢/sheet", parent: "t1" }
  ]), ["t2 \"$10.47\"", "t5 \"1.4 ¢/sheet\""]);
});

test("pieces that say a different amount from the line before are kept", () => {
  assert.deepEqual(bodyLines([
    { tag: "div" },
    { tag: "span", text: "$10.47", parent: "t1" },
    { tag: "span", text: "$999", ownText: "$9", parent: "t1" },
    { tag: "sup", text: "99", parent: "t3" },
    { tag: "span", text: "1.4 ¢/sheet", parent: "t1" }
  ]), ["t2 \"$10.47\"", "t3 \"$9\"", "t4 \"99\"", "t5 \"1.4 ¢/sheet\""]);
});
