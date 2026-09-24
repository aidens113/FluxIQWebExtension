// T1 coverage of the feed signal: a list is reported as holding more than it
// shows only when its page says so -- the ARIA feed pattern, or a declared row
// count larger than the run in the document -- never because it merely ends.
// The live fixture -- a `role="feed"` two levels above the posts -- is proven
// by `e2e/content/tests/extraction/tests/structure-detection.spec.ts`; these
// rows pin the rule with the smallest element the rule reads.

import assert from "node:assert/strict";
import test from "node:test";
import { isDeclaredFeed } from "../feed-signal";

type FakeElement = { getAttribute(name: string): string | null; parentElement: FakeElement | null };

function element(attributes: Record<string, string>, parentElement: FakeElement | null = null): FakeElement {
  return { getAttribute: (name) => attributes[name] ?? null, parentElement };
}

function chain(depth: number, top: Record<string, string>): FakeElement {
  let current = element(top);
  for (let level = 0; level < depth; level += 1) current = element({}, current);
  return current;
}

const asElements = (values: FakeElement[]) => values as unknown as Element[];
const asElement = (value: FakeElement | null) => value as unknown as Element | null;

test("a role=feed on the container or an ancestor within reach declares a feed", () => {
  assert.equal(isDeclaredFeed([], asElement(element({ role: "feed" }))), true);
  assert.equal(isDeclaredFeed([], asElement(chain(1, { role: "feed" }))), true);
  assert.equal(isDeclaredFeed([], asElement(chain(5, { role: "Feed region" }))), true);
  // Six levels is as far as the pagination search looks, and the feed search looks no further.
  assert.equal(isDeclaredFeed([], asElement(chain(6, { role: "feed" }))), false);
});

test("items whose set size is unknown declare a feed", () => {
  const item = element({ "aria-setsize": " -1 " });
  assert.equal(isDeclaredFeed(asElements([element({}), item]), asElement(element({}))), true);
});

test("an ordinary list, a known set size, or a role that only mentions feed does not", () => {
  assert.equal(isDeclaredFeed(asElements([element({ "aria-setsize": "40" })]), asElement(element({ role: "list" }))), false);
  assert.equal(isDeclaredFeed([], asElement(element({ role: "feedback" }))), false);
  assert.equal(isDeclaredFeed([], asElement(element({ "data-role": "feed" }))), false);
  assert.equal(isDeclaredFeed([], null), false);
});

// A virtualised grid does not use the feed pattern: it says `role="grid"` and
// `aria-rowcount`, the count of rows that exist rather than the count mounted.
// On 2026-09-24 `admin-console-customer-book` returned 19 records of 240,
// starting at CUS-0005 rather than CUS-0001 -- the window that happened to be
// mounted -- over a viewport that said `aria-rowcount="240"`
// (`run-muf1xufy-ecea7867`). Nothing looked at it.
test("a declared row count larger than the mounted run says the list holds more", () => {
  const mounted = asElements([element({}), element({})]);
  assert.equal(isDeclaredFeed(mounted, asElement(element({ role: "grid", "aria-rowcount": "240" }))), true);
  assert.equal(isDeclaredFeed(mounted, asElement(chain(5, { "aria-rowcount": "240" }))), true);
  // The count is read wherever it is declared; the role is not what carries it.
  assert.equal(isDeclaredFeed(mounted, asElement(element({ "aria-rowcount": " 240 " }))), true);
});

// A grid that renders all of its rows has no reason to declare a count, so one
// equal to the run says the list is all there. `-1` is ARIA's "not known",
// which says nothing either way, and anything unparseable is not a declaration.
test("a row count that is not larger, unknown, or unreadable declares nothing", () => {
  const mounted = asElements([element({}), element({})]);
  for (const rowcount of ["2", "1", "0", "-1", "", "  ", "many", "2.9e1x"]) {
    assert.equal(isDeclaredFeed(mounted, asElement(element({ role: "grid", "aria-rowcount": rowcount }))), false, rowcount);
  }
});
