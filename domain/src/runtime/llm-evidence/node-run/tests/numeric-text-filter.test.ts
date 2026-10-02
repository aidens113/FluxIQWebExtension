// The "reads as numbers" sentence only for a condition that compares digits by
// text (`../numeric-text-filter.ts`).
//
// Live run 13 (`run-muqbzu32-8691a65e`, cause 2): every read carried "where 4
// tests the text of name, which reads as numbers ($12.99: 3, $24.99: 600, ...)"
// for `name not contains ["ear tips", "charging case", ...]`, because every
// product name holds a digit ("Bluetooth 5.3", "50H Playtime"); the model spent
// two reruns answering a sentence about a condition that compares no number.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationExtractItemCondition } from "../../../../actions/extraction";
import { webNodeNumericTextFilterSentence } from "../numeric-text-filter";

/** Rejected rows whose names all hold a digit, as every product on a store does. */
const PRODUCTS = [
  { name: "Foam ear tips for Bluetooth 5.3 earbuds", price: "$9.99" },
  { name: "Charging case for 50H Playtime earbuds", price: "$24.99" },
  { name: "Replacement ear tips, 3 sizes", price: "$12.99" }
];
/** Rejected rows whose column says a count. */
const MUTUAL = [{ name: "Tom Becker", mutual: "1 mutual friend" }, { name: "Jonas Weber", mutual: "Aisha Khan and 4 other mutual friends" }];

function sentence(condition: WebAutomationExtractItemCondition, rows: readonly object[]): string | undefined {
  return webNodeNumericTextFilterSentence(4, condition, rows as never);
}

test("a text condition that compares no digit says nothing, however many digits the names it rejected hold (run 13)", () => {
  assert.equal(sentence({ field: "name", contains: ["ear tips", "charging case", "eartips", "replacement"], not: true }, PRODUCTS), undefined);
  assert.equal(sentence({ field: "name", matches: "/ear tips|charging case/i" }, PRODUCTS), undefined);
  // A quantifier's count is not a digit the pattern compares.
  assert.equal(sentence({ field: "mutual", matches: "/^\\w{4} /" }, MUTUAL), undefined);
});

test("a pattern with a digit or a digit class, or a contained term with a digit, still says it", () => {
  // Run 36's own condition.
  const run36 = sentence({ field: "mutual", matches: "/(?:[5-9]|[1-9][0-9]+) mutual/" }, MUTUAL);
  assert.ok(run36?.includes("Jonas Weber: 5"), run36);
  assert.ok(sentence({ field: "mutual", matches: "/\\d+ mutual friends/" }, MUTUAL)?.includes("use atLeast or atMost"));
  assert.ok(sentence({ field: "mutual", matches: "/\\p{Nd}+ mutual/u" }, MUTUAL)?.includes("Tom Becker: 1"));
  assert.ok(sentence({ field: "mutual", contains: ["5 mutual", "6 mutual"] }, MUTUAL)?.includes("where 4 tests the text of mutual"));
});
