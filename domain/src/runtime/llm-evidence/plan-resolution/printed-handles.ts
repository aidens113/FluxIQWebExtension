// The target handles a piece of evidence printed for the model (t378, lane B C4).
//
// The packet store holds every element of a capture, and the page view prints
// only some of them: an element with no words of its own and no control is
// left out (`../page-view/line/choice.ts`). Its handle still sits in the
// numbering gap between two printed ones, and a candidate that guessed one --
// lane B's `t551`, `t560` and `t570`, between a printed `t550` and `t555`
// (`run-mv0fu9pb-57454dc4`, 0058) -- resolved to a card wrapper it had never
// been shown. So the store also keeps which handles evidence printed, read
// here from what was printed.
//
// `line_start` reads a handle only where it begins a line, which is how the page
// view, a search and a description each name an element: a handle a page's own
// words happen to spell, or a search query echoed back, is not one printed.
// `anywhere` reads every handle token, for a structured result that names
// handles in its values (a failure packet's repair candidates). Either way only
// a handle the capture holds (`held`) counts.

import { canonicalWebLlmTargetHandle } from "../handle-spelling";

const AT_LINE_START = /^(?:t|target\.)[1-9][0-9]{0,5}(?![\p{L}\p{N}_.])/gmu;
const ANYWHERE = /(?<![\p{L}\p{N}_.])(?:t|target\.)[1-9][0-9]{0,5}(?![\p{L}\p{N}_])/gu;
/** How deep a structured result is walked for its strings. */
const MAX_DEPTH = 8;

/** The handles `value` printed, as the `tN` the store keeps them under, among those `held`. */
export function webLlmPrintedTargetHandles(value: unknown, held: { has(handle: string): boolean }, where: "line_start" | "anywhere"): Set<string> {
  const printed = new Set<string>();
  const pattern = where === "line_start" ? AT_LINE_START : ANYWHERE;
  const walk = (entry: unknown, depth: number): void => {
    if (depth > MAX_DEPTH) return;
    if (typeof entry === "string") {
      for (const match of entry.matchAll(pattern)) {
        const handle = canonicalWebLlmTargetHandle(match[0]);
        if (handle !== undefined && held.has(handle)) printed.add(handle);
      }
      return;
    }
    if (Array.isArray(entry)) {
      for (const item of entry) walk(item, depth + 1);
      return;
    }
    if (entry !== null && typeof entry === "object") for (const item of Object.values(entry)) walk(item, depth + 1);
  };
  walk(value, 0);
  return printed;
}
