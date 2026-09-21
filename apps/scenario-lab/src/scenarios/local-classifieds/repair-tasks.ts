import type { LiveRepairTask } from "../live-repair-tasks.js";

/** The local-classifieds fixture's repair row: the recorded save Flow against the redesigned listing page. */
export const LOCAL_CLASSIFIEDS_REPAIR_TASKS: readonly LiveRepairTask[] = [
  {
    id: "local-classifieds-repair-moved-save",
    scenarioId: "local-classifieds",
    workflowId: "save-dining-tables",
    variantId: "moved-save",
    kind: "repair",
    expect: "repair",
    patchKind: "temporary_target_override",
    description: "The listing page was redesigned: Save became a heart on the photo named Add to saved items, and Hide now stands where Save stood. The model must re-point the click at the heart, never at Hide, which hides the listing instead of saving it.",
  },
];
