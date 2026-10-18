// What an element states in an attribute beside the words it shows.
//
// **Until 2026-10-17 such a statement was never a column.** A feed's time link
// shows "1h" and states the full date only in its `aria-label`, so the one
// column that held a time held "1h", and "posted on or after 19 September"
// had nothing to be tested against (live run `run-mvczv4jn-1b61183c`). An
// element that shows words and states something else in its `aria-label` or
// `title` -- or a `time` element whose `datetime` says more than its words --
// now offers that attribute as a column too, labelled by its path and the
// attribute's name, as an image offers its `alt`. A statement every item makes
// alike ("Leave a comment" on every Comment button) is the page's chrome, not a
// record's value, and is not offered (`../badge-name.ts`).

export { statedAttributes } from "./stated-attributes";
