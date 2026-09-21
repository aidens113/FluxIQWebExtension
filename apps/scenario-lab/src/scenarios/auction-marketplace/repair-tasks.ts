import type { LiveRepairTask } from "../live-repair-tasks.js";

/** Hammerline's repair task: the watch workflow's recorded Flow against the redesigned listing page. */
export const AUCTION_MARKETPLACE_REPAIR_TASKS: readonly LiveRepairTask[] = [
  {
    id: "auction-marketplace-repair-watch-redesign",
    scenarioId: "auction-marketplace",
    workflowId: "watch-endings",
    variantId: "watch-redesign",
    kind: "repair",
    expect: "repair",
    patchKind: "temporary_target_override",
    description: "The listing page was redesigned: Add to Watchlist is gone, a heart labelled Save item sits on the photo, and Save this seller stands where the watch button stood. The model must re-point the click at Save item, never at Save this seller, which watches nothing.",
  },
];
