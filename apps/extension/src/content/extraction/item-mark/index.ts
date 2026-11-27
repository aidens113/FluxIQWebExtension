// Marks (contract CC2): what a row carries or not that is not a text cell.
//
// An icon badge is a mark too, offered by `../badge-name.ts`. This directory
// holds the other kinds and the one read a mark changes:
// `state-sources.ts` offers a control's pressed, checked, selected or disabled
// state as a column read only while it is on, and `own-state.ts` the item's
// own; `flag-attribute.ts` says which of an item's own attributes is a flag;
// `word-mark.ts` says which text element is a label some items carry in the
// same words, a badge drawn in words; `shown-value.ts` reads the view's own
// state tokens a `value` field names (a select's label and options, a
// checkbox's state, a refused cursor, a chosen chip), and `flag-value.ts` is
// how a flag reads, so a flag written empty or `"true"` holds a value and one
// written `"false"` holds none.

export { flagValue } from "./flag-value";
export { isFlagAttribute } from "./flag-attribute";
export { ownStateMarkSources } from "./own-state";
export { shownValue, type ShownValue } from "./shown-value";
export { stateMarkSources, type StateMarkSource } from "./state-sources";
export { wordMarks, type WordMarks } from "./word-mark";
