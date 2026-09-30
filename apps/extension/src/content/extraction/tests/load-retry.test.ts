// The Retry a failed load-more offers (lane t195, run `run-munnyvbr-11c28a0f`:
// Guildline's first Show more fails and only its Retry loads the rows). The
// label rule is the guard that keeps the read from pressing a Retry that acts:
// the whole label must ask to load again and nothing more.

import assert from "node:assert/strict";
import test from "node:test";
import { isLoadRetryLabel } from "../load-retry";

test("the labels a failed load offers are pressed", () => {
  for (const label of ["Retry", "retry", " Try again ", "Try again.", "Reload", "Load again", "Try loading again"]) {
    assert.equal(isLoadRetryLabel(label), true, label);
  }
});

test("a Retry that does something else, or a sentence, is never pressed", () => {
  for (const label of ["Retry payment", "Try again to publish", "Retry and send", "Something went wrong. Retry", "Place order", "Show more", "Delete", "", "Retry ".repeat(10)]) {
    assert.equal(isLoadRetryLabel(label), false, label);
  }
});
