// Where a loop pass's control is looked for (`../resolve-target.ts`): the page,
// not the saved identity, says whether the control is one row's, a row's
// control is only ever pressed in the pass's own row, and a copy that names
// itself by its row is placed there by structure (`row-slot.ts`).

export { resolvedForPass } from "./resolved-for-pass";
export type { PassOutcome } from "./resolved-for-pass";
