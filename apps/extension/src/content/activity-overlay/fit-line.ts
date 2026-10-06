// One line of the overlay, fitted to the width its card gives it, cut where a
// word ends.
//
// The pill's lines do not wrap: each shape has a fixed size, so a sentence
// never moves or resizes it (`status-pill.ts`). A line that does not fit used
// to end in the browser's own ellipsis, which falls wherever the width runs
// out: "Search Bri…", "trying another w…", "the check found the…" for "they"
// (U-4 of the run-muw60j7c-bb7c9a62 UI review). Here the line is measured as
// it will be drawn and cut after the last whole word that fits with its
// ellipsis (`longestWordCut`). When nothing can be measured -- no layout yet,
// no canvas -- or not even the first word fits, the line is left whole and
// the style's ellipsis is the backstop. Pure: the measuring is passed in.

import { longestWordCut } from "../../shared/activity";

/** Pixels kept free at the end of a line, so a measure that rounds differently from the page still fits. */
const SLACK_PX = 2;

/** `text`, or its longest cut at a word end whose measured width fits `room` pixels. */
export function fitLine(text: string, room: number, measure: (text: string) => number | undefined): string {
  if (!(room > 0)) return text;
  const whole = measure(text);
  if (whole === undefined || whole <= room - SLACK_PX) return text;
  return longestWordCut(text, (candidate) => (measure(candidate) ?? Number.POSITIVE_INFINITY) <= room - SLACK_PX) ?? text;
}
