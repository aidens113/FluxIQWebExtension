import assert from "node:assert/strict";
import test from "node:test";
import { fitLines } from "../lines";

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

// Round 5 of the breadth reruns: a detail ended "address is t…", cut inside a
// word. The canvas measure and the page's own layout can disagree by a few
// pixels over a line (page zoom, font hinting); a sentence fitted with no room
// to spare then overflows its last line, and the style's clamp, the backstop,
// cuts it wherever the width runs out. The margin kept free grows with the
// line, so a sentence fitted here still fits when the page draws it a little
// wider than it measured.
test("a sentence fitted to the lines still fits when the page draws it up to 2% wider than measured", () => {
  const room = 328;
  const wider = (text: string): number => measure(text) * 1.02;
  const wraps = (text: string, width: number): number => {
    let lines = 1;
    let line = "";
    for (const word of text.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (wider(candidate) <= width || line === "") line = candidate;
      else {
        lines += 1;
        line = word;
      }
    }
    return lines;
  };
  // Two lines of exactly 46 characters each: as measured, each fills its line to the last pixel.
  const line = "street street street street street house house";
  assert.equal(line.length, 46);
  for (const text of [`${line} ${line}`, `${line} ${line} and more after it`, line]) {
    const fitted = fitLines(text, room, measure, 2);
    assert.ok(wraps(fitted, room) <= 2, `"${fitted}" takes ${wraps(fitted, room)} lines as the page draws it`);
  }
});
