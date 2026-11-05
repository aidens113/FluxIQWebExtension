import assert from "node:assert/strict";
import test from "node:test";
import { forgetOutcomeWords } from "../forget-outcome-words";

test("a Forget that did not reach Core says so, and where to end it now", () => {
  const words = forgetOutcomeWords(false);
  assert.match(words, /could not be reached/u);
  assert.match(words, /still trusts this browser/u);
  assert.match(words, /revoke this browser under Connected browsers/u);
});

test("a Forget that reached Core says it is done", () => {
  assert.equal(forgetOutcomeWords(true), "Pairing forgotten. Connect again to pair this browser.");
  assert.equal(forgetOutcomeWords(undefined), "Pairing forgotten. Connect again to pair this browser.");
});
