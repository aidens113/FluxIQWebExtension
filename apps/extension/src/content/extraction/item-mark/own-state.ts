// An item's own pressed, checked, selected or disabled state as a column
// (contract CC2, t885 R1).
//
// The state columns are offered for what an item holds (`./state-sources.ts`),
// and an item that is itself the control -- a time in a timetable read one row
// per time (`../cell-run/`), a chip in a run of chips -- holds nothing: its
// state is on the item. Its column names the item itself while the state is on,
// `:scope` with the state's condition (`../field-element/`), under the label
// `item`, so a taken time's row carries `item (disabled)` and a free one's
// nothing.

import { isWithinSensitiveControl } from "../../sensitive-text";
import { stateMarkSources, type StateMarkSource } from "./state-sources";

/** How a column of the item itself is named: the item, by `:scope`. */
const ITEM_ITSELF = { selector: ":scope", label: "item" };

/** The state columns the item itself offers. */
export function ownStateMarkSources(item: Element): StateMarkSource[] {
  return stateMarkSources(item, ITEM_ITSELF, isWithinSensitiveControl(item));
}
