// One line of the page view as Core's page channel diffs it (t1036, P-b): a
// key that names the same line from one capture to the next, and the text the
// model reads.
//
// - An element line's key is its handle (`t49`), and its text starts with it.
// - A header line's key is its label (`PAGE`, `URL`, `VIEW`, ...); the blank
//   line between the header and the elements is `-`.
// - A marker line is keyed to the element line it stands before: `^t62`, then
//   `^t62.2` for a second marker there.
// - `extra` marks a line only a full capture shows -- a hidden element, an
//   element's attributes (`./full-view.ts`) -- which is shown in that delivery
//   and never part of the base a later diff is compared with.
//
// Core compares keys and texts; it never reads a text.

/** One keyed line of a page view. */
export type WebLlmPageLine = { key: string; text: string; extra?: true };
