// Where a loop pass's control is looked for when the build never placed it in a
// row (`../resolve-target.ts`): the page, not the saved identity, says whether
// the control is one row's, and a row's control is only ever pressed in the
// pass's own row.

export { resolvedForPass } from "./resolved-for-pass";
export type { PassOutcome } from "./resolved-for-pass";
