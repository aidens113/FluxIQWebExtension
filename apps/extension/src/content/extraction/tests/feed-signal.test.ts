// T1 coverage of the feed signal: a list is reported as an infinite feed only
// when its page declares the ARIA feed pattern, never because it merely ends.
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
