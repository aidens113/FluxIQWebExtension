import type { LiveRepairTask } from "../live-repair-tasks.js";

/** The professional network's repair entry point: the recorded withdrawal meeting a redesigned confirmation. */
export const PROFESSIONAL_NETWORK_REPAIR_TASKS: readonly LiveRepairTask[] = [
  {
    id: "professional-network-repair-redesigned-withdraw-dialog",
    scenarioId: "professional-network",
    variantId: "redesigned-withdraw-dialog",
    kind: "repair",
    expect: "repair",
    patchKind: "temporary_target_override",
    description: "The withdraw confirmation was redesigned: its confirm control lost the test hook the recording names, now reads Withdraw invitation and sits first, beside Keep invitation. The model must re-point the confirmation click at Withdraw invitation, never at Keep invitation, which leaves every request pending.",
  },
];
