// How the controls line says which heading a control fell under (t869).
//
// `state.page.controls` is a flat line of control names. Kept in an evidence
// history after the page view is gone, it had lost the words the page set
// above a group of controls: "Results outside your search" over two listings
// that do not match, so a later reading took them for matches. The line now
// writes the heading in front of the first control it covers, in square
// brackets, and writes it again only where the heading changes:
//
//   [Results outside your search] £30 Small dining table | £55 White gloss table
//
// The mark is the line's only addition. A control's name is never changed or
// dropped, so every consumer that compares what the page offers reads names:
// `webRouteControlName` is the one place that takes the mark off an entry, and
// it is what the route signature, a step's effect and a page's own changes
// compare by, so a heading never makes an unchanged page read as changed.

const MARK = /^\[[^\]\n]*\] /u;

/** The entry as the producer writes it: the heading's words in front of the control's name. */
export function webRouteMarkedControl(heading: string, name: string): string {
  return `[${heading.replace(/\s+/gu, " ").trim().replace(/ \| /gu, " / ").replace(/\]/gu, ")")}] ${name}`;
}

/** An entry of the controls line as the control's name alone, whether or not it carries a heading. */
export function webRouteControlName(entry: string): string {
  return entry.replace(MARK, "");
}
