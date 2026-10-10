// Reading a selector already written down back into the identifiers it is
// addressed through, so `identity/score.ts` can ask the page whether any
// element still carries them.

import assert from "node:assert/strict";
import test from "node:test";
import { quotedAnchors } from "../quoted-anchors";

const value = (selector: string) => quotedAnchors(selector).map(({ attribute, value: held }) => [attribute, held]);

test("an id selector is read as the id it names: R4a's quantity box", () => {
  assert.deepEqual(quotedAnchors("#fb1l6ufkg"), [{ attribute: "id", value: "fb1l6ufkg", written: "#fb1l6ufkg" }]);
});

test("CSS escapes are undone, so the value is what the attribute holds", () => {
  assert.deepEqual(value("#\\:r13b8o\\: > div > div:nth-of-type(2) > button:nth-of-type(1)"), [["id", ":r13b8o:"]]);
  assert.deepEqual(value("#\\31 23 > a"), [["id", "123"]]);
  assert.deepEqual(value('[data-testid="say \\"hi\\""]'), [["data-testid", 'say "hi"']]);
});

test("every anchor attribute an author names an element by is read, quoted either way", () => {
  assert.deepEqual(value('[data-testid="qty"] > input[name=\'quantity\']'), [["data-testid", "qty"], ["name", "quantity"]]);
  assert.deepEqual(value('[data-test="a"] [data-cy="b"] [id="c"]'), [["data-test", "a"], ["data-cy", "b"], ["id", "c"]]);
});

test("structure, classes and other attributes are not identifiers", () => {
  assert.deepEqual(value(".qtyRow > input:nth-of-type(1)"), []);
  assert.deepEqual(value('a[href="#top"]'), [], "a # inside a quoted value is not an id selector");
  assert.deepEqual(value('[data-testid^="row-"]'), [], "a prefix match names a family, not an element");
  assert.deepEqual(value("button"), []);
});
