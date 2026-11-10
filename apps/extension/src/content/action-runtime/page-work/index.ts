// Barrel for the content script's questions to the page world about the work
// the page set in motion (task speed S10, t893): whether it has settled, and
// the wait an action makes after the page moved its address in place.
export { askPageQuiet } from "./page-quiet";
export { ADDRESS_SETTLE_DEADLINE_MS, forgetSettledAddressForTest, settleAddressMove } from "./address-settle";

export type { PageQuiet } from "./page-quiet";
export type { AddressSettle } from "./address-settle";
