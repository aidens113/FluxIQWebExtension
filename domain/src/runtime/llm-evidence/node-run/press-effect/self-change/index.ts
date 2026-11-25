// Barrel for what a page changes by itself (t1043): what its own markup says rotates or
// announces (`./markers.ts`), the lines the run has seen change with nothing done
// (`./memory.ts`, fed through the run's target packets by `./watch.ts`), and, from both,
// which elements a press must not be credited with (`./own-changes.ts`).

export { webSelfChangingMarkup } from "./markers";
export { createWebPressSelfChanges, webPressSeenChanging, type WebPressSelfChanges, type WebPressSelfChangeScope } from "./memory";
export { webPageOwnChanges } from "./own-changes";
export { webPressSelfChangeWatch } from "./watch";
