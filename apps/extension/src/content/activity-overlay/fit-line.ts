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
//
// A control's name, which Core says in curly quotes (“Get coupons”), is what
// tells one step from another, so a cut never falls inside it: "Checking an
// earlier step is still done: clicking “Get…”" dropped the name of a two-word
// button (D6 of the t342 round 2 UI review, run-muylu4pp-f9cb2121). When the
// line cannot keep its names, the words before its colon give way first --
// the headline above already says what kind of work this is -- and it reads
// "Clicking “Get coupons”".

import { longestWordCut } from "../../shared/activity";

/** Pixels kept free at the end of a line, so a measure that rounds differently from the page still fits. */
const SLACK_PX = 2;
/** A control's name as Core quotes it. */
const NAME = /“[^”]+”/gu;
/** The ellipsis a cut ends in (`longestWordCut`); the last one in a cut line is the cut's own. */
const ELLIPSIS = "…";
/** Where the words that lead into a line's subject end: "Doing an earlier step again first: clicking …". */
const LEAD_END = ": ";

type Span = { start: number; end: number };

/** `text`, or its longest cut at a word end whose measured width fits `room` pixels, never inside a quoted name. */
export function fitLine(text: string, room: number, measure: (text: string) => number | undefined): string {
  if (!(room > 0)) return text;
  const whole = measure(text);
  if (whole === undefined || whole <= room - SLACK_PX) return text;
  const fits = (candidate: string): boolean => (measure(candidate) ?? Number.POSITIVE_INFINITY) <= room - SLACK_PX;
  const names = namesIn(text);
  const cut = cutKeepingNames(text, names, fits);
  if (names.length === 0 || (cut !== null && keepsEvery(cut, names))) return cut ?? text;
  const tail = afterLead(text, names[0]!.start);
  if (tail !== undefined) {
    if (fits(tail)) return tail;
    const tailNames = namesIn(tail);
    const tailCut = cutKeepingNames(tail, tailNames, fits);
    if (tailCut !== null && keepsEvery(tailCut, tailNames)) return tailCut;
  }
  return cut ?? longestWordCut(text, fits) ?? text;
}

function namesIn(text: string): Span[] {
  return [...text.matchAll(NAME)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
}

/** The longest cut that fits and leaves every name whole or out. */
function cutKeepingNames(text: string, names: readonly Span[], fits: (candidate: string) => boolean): string | null {
  return longestWordCut(text, (candidate) => fits(candidate) && !names.some((name) => name.start < kept(candidate) && kept(candidate) < name.end));
}

/** How much of the line a cut keeps: everything before its own ellipsis, a prefix of the line. */
function kept(candidate: string): number {
  return candidate.lastIndexOf(ELLIPSIS);
}

function keepsEvery(candidate: string, names: readonly Span[]): boolean {
  return names.every((name) => name.end <= kept(candidate));
}

/** The line from its subject on, capitalised, when words lead into it before a colon; undefined otherwise. */
function afterLead(text: string, firstName: number): string | undefined {
  const lead = text.lastIndexOf(LEAD_END, firstName);
  if (lead <= 0) return undefined;
  const tail = text.slice(lead + LEAD_END.length);
  return tail ? `${tail.charAt(0).toUpperCase()}${tail.slice(1)}` : undefined;
}
