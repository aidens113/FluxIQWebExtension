// The two bounds every row walk of `control-row/` is held to.

/**
 * How far up the tree a row may be -- a control sits a few wrappers inside its
 * row, not ten levels above it -- and how many nodes a climb may walk while
 * looking for a second alike control: a row is a row, not a document.
 */
export const ROW_BOUNDS = { depth: 12, scan: 2_000 } as const;
