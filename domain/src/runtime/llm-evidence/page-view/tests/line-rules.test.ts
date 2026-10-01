// Which elements get a line: rules 1 to 4 and the folds F1, F2, F3 and the
// image rule, each on a packet built for it, with and without `parent`.

import assert from "node:assert/strict";
import test from "node:test";
import { bodyLines } from "./packet-fixture";

const LINK = "https://shop.test/store/item";

test("1: a visible control gets a line, words or not, and so does one with no box; an off-page or hidden one does not", () => {
  assert.deepEqual(bodyLines([
    { tag: "a", href: LINK },
    { tag: "button", name: "Go" },
    { tag: "input", name: "Search in", box: { x: -9768, y: 10, width: 9, height: 7 } },
    { tag: "button", name: "Hidden", hidden: true },
    { tag: "button", name: "No box", box: undefined }
  ]), ["t1 link ~/item", "t2 button \"Go\"", "t5 button \"No box\""]);
});

test("2: a visible layer gets a line, with words or without", () => {
  assert.deepEqual(bodyLines([
    { tag: "div", isDialog: { modal: true, kind: "consent" }, name: "Cookie preferences" },
    { tag: "div", covers: ["t1"] }
  ]), ["t1 dialog \"Cookie preferences\" modal consent", "t2 layer covers 1"]);
});

test("3: a visible non-control with meaningful own words gets a text line; punctuation and empty own words do not", () => {
  assert.deepEqual(bodyLines([
    { tag: "span", text: "Sponsored" },
    { tag: "span", text: "·" },
    { tag: "li", text: "Kettle", ownText: "" },
    { tag: "span", text: "★ 4.5" },
    { tag: "h2", name: "Kettles" }
  ]), ["t1 \"Sponsored\"", "t4 \"★ 4.5\"", "t5 h2 \"Kettles\""]);
});

test("F1: words under a control or a semantic line fold into it; under a plain text line they do not", () => {
  assert.deepEqual(bodyLines([
    { tag: "a", href: LINK, name: "Kettle" },
    { tag: "span", text: "Kettle", parent: "t1" },
    { tag: "li", text: "Ships today Learn more", ownText: "Ships today" },
    { tag: "b", text: "Learn more", parent: "t3" },
    { tag: "div", text: "Deliver to", ownText: "Deliver to" },
    { tag: "b", text: "Portland", parent: "t5" },
    { tag: "div", parent: "t1" },
    { tag: "span", text: "deep", parent: "t7" }
  ]), ["t1 link \"Kettle\" ~/item", "t3 \"Ships today Learn more\"", "t5 \"Deliver to\"", "t6 \"Portland\""]);
});

test("F1 needs parent: without it the duplicate is printed, never dropped", () => {
  assert.deepEqual(bodyLines([
    { tag: "a", href: LINK, name: "Kettle" },
    { tag: "span", text: "Kettle deluxe" }
  ]), ["t1 link \"Kettle\" ~/item", "t2 \"Kettle deluxe\""]);
});

test("F2: a label saying what the control beside it says is folded, before or after", () => {
  assert.deepEqual(bodyLines([
    { tag: "label", text: "Search in" },
    { tag: "select", name: "Search in" },
    { tag: "input", name: "Email" },
    { tag: "label", text: "email " },
    { tag: "label", text: "Remember me" },
    { tag: "input", inputType: "checkbox", name: "Keep me signed in" }
  ]), ["t2 select \"Search in\"", "t3 field \"Email\"", "t5 \"Remember me\"", "t6 checkbox \"Keep me signed in\""]);
});

test("F3: a text line saying what the line before it says is folded, case and spacing aside", () => {
  assert.deepEqual(bodyLines([
    { tag: "a", href: LINK, name: "$39.99" },
    { tag: "span", text: "$39.99$39.99" },
    { tag: "span", text: "$39.99 " },
    { tag: "span", text: "Free  DELIVERY" },
    { tag: "span", text: "free delivery" }
  ]), ["t1 link \"$39.99\" ~/item", "t4 \"Free DELIVERY\""]);
});

test("4: an image prints its alt unless a line of its item already says it, or F1 folds it", () => {
  const item = { index: 1, total: 2 };
  assert.deepEqual(bodyLines([
    { tag: "img", name: "Pulsebud Neo ANC Wireless Earbuds, Black", item },
    { tag: "span", text: "Pulsebud", item },
    { tag: "a", href: LINK, name: "Pulsebud Neo ANC Wireless Earbuds, Black", item },
    { tag: "i", role: "img", name: "Brightaisle Plus", item },
    { tag: "span", text: "4", item },
    { tag: "img", name: "4K screen", item: { index: 2, total: 2 } },
    { tag: "span", text: "4", item: { index: 2, total: 2 } },
    { tag: "a", href: LINK, name: "Go" },
    { tag: "img", name: "Arrow", parent: "t8" }
  ]), [
    "- 1/2",
    "t2 \"Pulsebud\"",
    "t3 link \"Pulsebud Neo ANC Wireless Earbuds, Black\" ~/item",
    "t4 img \"Brightaisle Plus\"",
    "t5 \"4\"",
    "- 2/2",
    "t6 img \"4K screen\"",
    "t7 \"4\"",
    // `~/item` is shorter than `same href`, so it is written out.
    "t8 link \"Go\" ~/item"
  ]);
});

test("4: outside an item an image compares only with the lines next to it", () => {
  assert.deepEqual(bodyLines([
    { tag: "h1", text: "Kettles" },
    { tag: "span", text: "Gooseneck kettle" },
    { tag: "img", name: "Kettles" },
    { tag: "img", name: "Gooseneck kettle in steel" },
    { tag: "img", name: "Gooseneck kettle in steel" }
  ]), ["t1 h1 \"Kettles\"", "t2 \"Gooseneck kettle\"", "t3 img \"Kettles\"", "t4 img \"Gooseneck kettle in steel\"", "t5 img \"Gooseneck kettle in steel\""],
  "two alike images do not remove each other, and a line further away does not remove one");
});

test("words the capture read from separate blocks print apart; an authored name prints as it is", () => {
  // lane B's bigbox run (2026-10-01): the store chip and the account link, each
  // two stacked lines, read "Pickup or delivery?Carden Falls Supercenter" and
  // "Sign InAccount". The capture sends the readable words beside them.
  assert.deepEqual(bodyLines([
    { tag: "button", name: "Pickup or delivery?Carden Falls Supercenter", readable: "Pickup or delivery? Carden Falls Supercenter" },
    { tag: "p", text: "Sign InAccount", readable: "Sign In Account" },
    { tag: "button", name: "Close dialog", readable: "× Close" }
  ]), ["t1 button \"Pickup or delivery? Carden Falls Supercenter\"", "t2 \"Sign In Account\"", "t3 button \"Close dialog\""]);
});
