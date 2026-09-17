// The distinct strings of a list, in first-seen order, with anything that is
// not a string dropped. Task ids, issue codes, patch kinds and action types all
// pass through it before they reach a summary or an error message.

export function distinct(values) { return [...new Set(values.filter((value) => typeof value === "string"))]; }
