// Marks (contract CC2): what a row carries or not that is not a text cell.
//
// An icon badge is a mark too, offered by `../badge-name.ts`. This directory
// holds the other two kinds and the one read a mark changes:
// `state-sources.ts` offers a control's pressed, checked or selected state as a
// column read only while it is on; `flag-attribute.ts` says which of an item's
// own attributes is a flag; and `flag-value.ts` is how a flag reads, so a flag
// written empty or `"true"` holds a value and one written `"false"` holds none.

export { flagValue } from "./flag-value";
export { isFlagAttribute } from "./flag-attribute";
export { stateMarkSources, type StateMarkSource } from "./state-sources";
