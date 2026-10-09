import assert from "node:assert/strict";
import test from "node:test";
import { fitLines } from "../fit-lines";

/** Seven pixels a character, as the status pill's own test measures. */
const measure = (text: string): number => text.length * 7;
/** 46 characters a line, after the slack. */
const ROOM = 46 * 7 + 2;

// Lane D (run-mv0fuual-f9e6f089, finding 9): "A step didn't work in the test: the…".
test("a sentence too long for one line wraps onto the next whole, never cut on the first", () => {
  const line = "A step didn't work in the test: the site asked FluxIQ to slow down";
  assert.ok(measure(line) > ROOM);
  assert.equal(fitLines(line, ROOM, measure, 2), line);
});

test("a sentence that fits one line, or cannot be measured, is left whole; one line is fitted as one line was", () => {
  assert.equal(fitLines("Deciding the next step", ROOM, measure, 2), "Deciding the next step");
  assert.equal(fitLines("A".repeat(400), ROOM, () => undefined, 2), "A".repeat(400));
  assert.equal(fitLines("Updating the Flow — that didn't work", 22 * 7 + 2, measure, 1), "Updating the Flow…");
});

test("text too long for every line keeps its whole sentences that fit", () => {
  const text = "The AI model's reply couldn't be read or used. Asking it again; the build stops if its replies keep being unusable.";
  assert.equal(fitLines(text, ROOM, measure, 2), "The AI model's reply couldn't be read or used.");
});

test("one sentence too long for every line is cut where a word ends, within the lines", () => {
  const text = "Checking that every one of the eight friend requests on the page with at least five mutual friends was confirmed and none other";
  const fitted = fitLines(text, ROOM, measure, 2);
  assert.ok(fitted.endsWith("…"), fitted);
  assert.ok(text.startsWith(fitted.slice(0, -1)), fitted);
  assert.ok(fitted.length <= 2 * 46 + 1, fitted);
  assert.match(fitted.slice(0, -1), /\S$/u);
});
