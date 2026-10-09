// A sentence of the overlay fitted to the lines its card gives it, wrapping
// where words end rather than cut on its first line.
//
// The detail line was one line, cut after the last word that fit: "A step
// didn't work in the test: the…", "Running step 9 of 9: Waiting for the…" --
// never inside a word, but the sentence was gone (lane D, run-mv0fuual-f9e6f089,
// finding 9). Here the sentence wraps onto as many lines as the card holds,
// measured as the browser will wrap it, a line breaking before the first word
// that does not fit. When it still does not fit, its whole sentences that do
// are said (the first of "Asking it again. The build stops if ..."), and only
// when not even one does is it cut where a word ends, as one line was
// (`fit-line.ts`). Nothing that cannot be measured is cut: the style's own
// clamp is the backstop. Pure: the measuring is passed in.

import { longestWordCut } from "../../shared/activity";
import { fitLine } from "./fit-line";

/** Pixels kept free at the end of a line, as `fit-line.ts` keeps them. */
const SLACK_PX = 2;
/** Where one sentence ends and the next starts. */
const SENTENCE_END = /(?<=[.!?])\s+(?=\S)/u;

/** `text` wrapped within `lines` lines of `room` pixels: whole, else its whole sentences that fit, else cut where a word ends. */
export function fitLines(text: string, room: number, measure: (text: string) => number | undefined, lines: number): string {
  if (lines <= 1) return fitLine(text, room, measure);
  if (!(room > 0) || measure(text) === undefined) return text;
  const fits = (candidate: string): boolean => {
    const used = linesOf(candidate, room - SLACK_PX, measure);
    return used !== undefined && used <= lines;
  };
  if (fits(text)) return text;
  const sentences = text.split(SENTENCE_END);
  for (let count = sentences.length - 1; count >= 1; count -= 1) {
    const whole = sentences.slice(0, count).join(" ");
    if (fits(whole)) return whole;
  }
  return longestWordCut(text, fits) ?? fitLine(text, room, measure);
}

/** How many lines `text` takes when wrapped where words end within `width` pixels; undefined when it cannot be measured. */
function linesOf(text: string, width: number, measure: (text: string) => number | undefined): number | undefined {
  let count = 1;
  let line = "";
  for (const word of text.split(" ").filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    const wide = measure(candidate);
    if (wide === undefined) return undefined;
    if (wide <= width || line === "") {
      line = candidate;
      // One word wider than a whole line overflows it: no wrap would hold it.
      if (wide > width) return Number.POSITIVE_INFINITY;
      continue;
    }
    count += 1;
    line = word;
    const alone = measure(word);
    if (alone === undefined) return undefined;
    if (alone > width) return Number.POSITIVE_INFINITY;
  }
  return count;
}
