import type { LiveRepairTask } from "../live-repair-tasks.js";

/** ValueRidge's rows in the live repair list: the recorded cart Flow against the product-page redesign. */
export const BIGBOX_RETAIL_REPAIR_TASKS: readonly LiveRepairTask[] = [
  {
    id: "bigbox-retail-repair-redesigned-buy-box",
    scenarioId: "bigbox-retail",
    variantId: "redesigned-buy-box",
    kind: "repair",
    expect: "repair",
    patchKind: "temporary_target_override",
    description: "The product page was redesigned: Add to cart lost its automation id and moved up into the buy box, and Buy now, which skips the cart and checks out one item alone, now stands in the pinned bar where Add to cart was. The model must re-point both recorded presses at the new Add to cart, never at Buy now.",
  },
];
