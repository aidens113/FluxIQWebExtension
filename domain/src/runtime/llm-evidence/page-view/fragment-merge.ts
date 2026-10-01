// Rule F4 of the page view (t223): letterless fragments become one line.
//
// A price is often drawn as three elements -- `$`, `39.`, `99` -- each its own
// text line with no letter in it, which reads as three numbers. A maximal run
// of two or more consecutive text lines with no letter becomes one line for
// their nearest common ancestor `A`, whose words are the pieces joined with no
// separator, when all three hold:
//
//  - `A` has no line of its own;
//  - `A` holds no control;
//  - every line under `A` is in the run.
//
// Otherwise the run stays as it is: words are never dropped to save a line.
//
// The third condition is stated over lines, where the format says "every
// visible meaningful-text element under `A`". An element F1 or F3 folded has
// no line because its words are already printed; counting it would keep the
// fragments of a price whose screen-reader copy was folded beside them, which
// is exactly the price F4 is for. A joined line that then says exactly what
// the line before it says is folded as F3 folds any text line.
//
// It needs `parent`. Without it there is no common ancestor, and no run joins.

import type { WebLlmEvidenceElement } from "../elements";
import { normalisedWords, undoubledWords, webLlmViewTraits } from "./element";
import type { WebLlmPageTree } from "./page-tree";
import type { WebLlmViewLine } from "./view-line";

const LETTER = /\p{L}/u;

/** The lines with every run of letterless fragments that may be joined, joined. */
export function mergedWebLlmFragments(lines: readonly WebLlmViewLine[], elements: readonly WebLlmEvidenceElement[], tree: WebLlmPageTree): WebLlmViewLine[] {
  const lined = new Set(lines.map((line) => line.element));
  const result: WebLlmViewLine[] = [];
  let index = 0;
  while (index < lines.length) {
    const end = runEnd(lines, index);
    const run = withoutRepeatedPieces(lines.slice(index, end), result.at(-1));
    const joined = run.length >= 2 ? joinedRun(run, elements, tree, lined) : undefined;
    if (joined === undefined) result.push(...run);
    else if (!saysWhatPreviousSays(result.at(-1), joined)) result.push(joined);
    index = end;
  }
  return result;
}

/** What two writings of one amount share: their characters less spacing, `.` and `,`. */
function skeleton(words: string | undefined): string {
  return (words ?? "").replace(/[\s.,]/gu, "");
}

/**
 * The run less every stretch of its fragments that only repeats, in pieces,
 * the fragment line just before it. A store prints a price once for a screen
 * reader and once more, drawn in pieces, for the eye -- bigbox's tile:
 * `<span>$10.47</span>` beside an `aria-hidden` `<span>$10<sup>47</sup></span>`
 * -- and the view printed it three times, `$10.47`, `$10`, `47` (lane B's
 * bigbox run, 2026-10-01), because the unit price under the same holder kept
 * F4 from joining the pieces. The pieces are compared with the line before by
 * their characters less spacing, `.` and `,`, so `$10` and `47` repeat
 * `$10.47`. Only fragments fold; a line with a letter is never dropped.
 */
function withoutRepeatedPieces(run: readonly WebLlmViewLine[], before: WebLlmViewLine | undefined): WebLlmViewLine[] {
  if (!run.every(isFragment)) return [...run];
  const kept: WebLlmViewLine[] = [];
  let previous = before !== undefined && isFragment(before) ? skeleton(before.words) : "";
  let index = 0;
  while (index < run.length) {
    const repeatEnd = repeatedStretchEnd(run, index, previous);
    if (repeatEnd !== undefined) {
      index = repeatEnd;
      continue;
    }
    const line = run[index] as WebLlmViewLine;
    kept.push(line);
    previous = skeleton(line.words);
    index += 1;
  }
  return kept;
}

/** One past the stretch from `start` whose pieces together say `previous`, or `undefined` when none does. */
function repeatedStretchEnd(run: readonly WebLlmViewLine[], start: number, previous: string): number | undefined {
  if (previous === "") return undefined;
  let said = "";
  for (let end = start; end < run.length; end += 1) {
    said += skeleton((run[end] as WebLlmViewLine).words);
    if (said === previous) return end + 1;
    if (!previous.startsWith(said)) return undefined;
  }
  return undefined;
}

/** One past the last line of the letterless run starting at `start`, or `start + 1` when the line there is not a fragment. */
function runEnd(lines: readonly WebLlmViewLine[], start: number): number {
  let end = start;
  while (end < lines.length && isFragment(lines[end] as WebLlmViewLine)) end += 1;
  return Math.max(end, start + 1);
}

/**
 * A line that is a lone math symbol -- a stepper's `+` or `−`, a close `×` --
 * is not a fragment: it is a control drawn as text, and joining it into its
 * neighbours (`− 1 +`) would leave the model no handle to press it by.
 */
const LONE_SYMBOL = /^\s*\p{Sm}\s*$/u;

function isFragment(line: WebLlmViewLine): boolean {
  return line.role === "text" && line.words !== undefined && !LETTER.test(line.words) && !LONE_SYMBOL.test(line.words);
}

function joinedRun(run: readonly WebLlmViewLine[], elements: readonly WebLlmEvidenceElement[], tree: WebLlmPageTree, lined: ReadonlySet<WebLlmEvidenceElement>): WebLlmViewLine | undefined {
  const members = run.map((line) => line.element);
  const holder = commonAncestor(members, tree);
  if (holder === undefined || lined.has(holder)) return undefined;
  const inRun = new Set(members);
  for (const element of elements) {
    if (element.hidden === true || !tree.isUnder(element, holder)) continue;
    if (webLlmViewTraits(element).control) return undefined;
    if (lined.has(element) && !inRun.has(element)) return undefined;
  }
  const words = undoubledWords(run.map((line) => line.words ?? "").join(""));
  return { element: holder, role: "text", words, merged: members };
}

function commonAncestor(members: readonly WebLlmEvidenceElement[], tree: WebLlmPageTree): WebLlmEvidenceElement | undefined {
  const [first, ...rest] = members;
  if (first === undefined) return undefined;
  return tree.ancestors(first).find((ancestor) => rest.every((member) => tree.isUnder(member, ancestor)));
}

function saysWhatPreviousSays(previous: WebLlmViewLine | undefined, joined: WebLlmViewLine): boolean {
  return previous?.words !== undefined && joined.words !== undefined && normalisedWords(previous.words) === normalisedWords(joined.words);
}
