// What a move brought, told by what the items say (`../unread-record.ts`, t885 R5).

import assert from "node:assert/strict";
import test from "node:test";
import { FakeElement } from "../../tests/store-pager";
import { recordMeaning } from "../record-meaning";
import { unreadRecordShown } from "../unread-record";

const item = (text: string, href?: string): Element => new FakeElement("li", {}, "", [new FakeElement("a", href === undefined ? {} : { href }, text)]) as unknown as Element;

test("the same records drawn again in new elements are nothing unread", () => {
  const before = [item("One", "/1"), item("Two", "/2")].map(recordMeaning);
  assert.equal(unreadRecordShown(before, [item("One", "/1"), item("Two", "/2")]), false);
});

test("a record that says something new is unread, and so is one more of a record that repeats", () => {
  const before = [item("+1"), item("Two", "/2")].map(recordMeaning);
  assert.equal(unreadRecordShown(before, [item("+1"), item("Two", "/2"), item("Three", "/3")]), true);
  assert.equal(unreadRecordShown(before, [item("+1"), item("Two", "/2"), item("+1")]), true);
});

test("a photo with no words is told apart by its image", () => {
  const photo = (src: string): Element => new FakeElement("li", {}, "", [new FakeElement("img", { src })]) as unknown as Element;
  assert.notEqual(recordMeaning(photo("/a.jpg")), recordMeaning(photo("/b.jpg")));
});
