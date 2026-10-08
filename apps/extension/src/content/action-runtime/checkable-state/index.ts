// Setting a control to a requested state rather than toggling it: a checkbox or
// radio by its `checked`, and a control the page draws itself by the chosen
// state it shows (t364). `checkable-state.ts` sets; `chosen-state.ts` reads.

export { setCheckedState } from "./checkable-state";

export type { CheckableStateOutcome } from "./checkable-state";
export type { ChosenStateReading } from "./chosen-state";
