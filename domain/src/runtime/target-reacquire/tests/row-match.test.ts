// A read's row found again among the fresh rows by identity, never by position
// (t786, D4). Shaped after the observed failure: a feed whose re-render moved a
// post and changed its like count and relative time.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webReacquireRow, webReacquireRowKeyColumns, webReacquireVolatileText } from "..";

const STALE: JsonObject = { author: "Mara Quill", text: "Kayak trip on the north lake this weekend", likes: "12 likes", posted: "5 min ago" };

function match(stale: JsonObject, candidates: JsonObject[], parameters?: JsonObject) {
  return webReacquireRow({ stale, candidates, keyColumns: webReacquireRowKeyColumns(parameters, stale) });
}

test("a row that moved and whose count and time changed is found, and the fresh row is answered", () => {
  const fresh = { author: "Mara Quill", text: "Kayak trip on the north lake  this weekend", likes: "13 likes", posted: "6 min ago" };
  const candidates = [
    { author: "Ilya Brandt", text: "New bakery opened downtown", likes: "4 likes", posted: "1 min ago" },
    { author: "Ilya Brandt", text: "Kayak trip on the north lake this weekend?", likes: "0 likes", posted: "now" },
    fresh
  ];
  assert.deepEqual(match(STALE, candidates), { outcome: "found", value: fresh });
});

test("the same words under another author are another item, never this one", () => {
  const other = { author: "Ilya Brandt", text: STALE.text!, likes: "12 likes", posted: "5 min ago" };
  assert.deepEqual(match(STALE, [other]), { outcome: "gone" });
});

test("a row one word apart is another item", () => {
  const other = { author: "Mara Quill", text: "Kayak trip on the south lake this weekend", likes: "12 likes", posted: "5 min ago" };
  assert.deepEqual(match(STALE, [other]), { outcome: "gone" });
});

test("a word column one side lacks is a difference", () => {
  const other = { author: "Mara Quill", text: STALE.text!, likes: "12 likes", posted: "5 min ago", badge: "Pinned" };
  assert.deepEqual(match(STALE, [other]), { outcome: "gone" });
});

test("two candidates that are both the row are ambiguous, not a guess", () => {
  const twin = { ...STALE, likes: "14 likes" };
  assert.deepEqual(match(STALE, [twin, { ...twin }]), { outcome: "unmatched", reason: "ambiguous" });
});

test("a row that says fewer than two things an item is told by is unidentifiable", () => {
  assert.deepEqual(match({ title: "Lamp", price: "$12.99", seen: "2 days ago" }, [{ title: "Lamp", price: "$11.99", seen: "3 days ago" }]), { outcome: "unmatched", reason: "unidentifiable" });
  assert.deepEqual(match({ likes: "12", posted: "5h" }, [{ likes: "12", posted: "5h" }]), { outcome: "unmatched", reason: "unidentifiable" });
});

test("the read's declared row identity decides, through Core's dedupe identity", () => {
  const stale = { title: "Brass desk lamp", seller: "Oakline", price: "$40" };
  const parameters = { extractList: { dedupe: { by: ["title", "seller"] } } };
  assert.deepEqual(webReacquireRowKeyColumns(parameters, stale), ["title", "seller"]);
  const fresh = { title: "BRASS DESK LAMP", seller: "Oakline", price: "$35", condition: "Used" };
  assert.deepEqual(match(stale, [{ title: "Brass desk lamp", seller: "Nordvik", price: "$40" }, fresh], parameters), { outcome: "found", value: fresh });
  // A dedupe moved into the record output's process is the same declaration.
  assert.deepEqual(webReacquireRowKeyColumns({ recordOutput: { process: { dedupe: { by: ["seller"] } } } }, stale), ["seller"]);
  // A dedupe over every column is "list each once", not an identity.
  assert.deepEqual(webReacquireRowKeyColumns({ dedupe: { by: ["title", "seller", "price"] } }, stale), []);
});

test("a link column is a key: the same link is the item, whatever its words became", () => {
  const stale = { title: "Kayak trip", link: "https://social.example.test/p/881", likes: "12" };
  assert.deepEqual(webReacquireRowKeyColumns(undefined, stale), ["link"]);
  const fresh = { title: "Kayak trip (edited)", link: "https://social.example.test/p/881", likes: "13" };
  assert.deepEqual(match(stale, [{ title: "Kayak trip", link: "https://social.example.test/p/882", likes: "12" }, fresh]), { outcome: "found", value: fresh });
  // A picture's address is not the item's.
  assert.deepEqual(webReacquireRowKeyColumns(undefined, { title: "Kayak trip", imageUrl: "https://cdn.example.test/a.jpg", thumb: "/img/a.jpg" }), []);
});

test("volatile values are numbers, counts, prices and times only", () => {
  for (const value of ["12", "12 likes", "1.2k views", "$1,299.00", "EUR 169,00", "(34)", "4.5/5", "5 min ago", "2d 4h left", "yesterday at 10:30", "Oct 28, 2026", "2026-10-28T10:00Z", "12 likes · 3 comments", "ends in 3 days"]) {
    assert.equal(webReacquireVolatileText(value), true, value);
  }
  for (const value of ["iPhone 15", "Mara Quill", "Kayak trip", "Like", "Model 3 Long Range", ""]) {
    assert.equal(webReacquireVolatileText(value), false, value);
  }
});
