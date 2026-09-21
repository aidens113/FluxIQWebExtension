import type { LiveRepairTask } from "../live-repair-tasks.js";

/**
 * The job board's recorded-Flow repair tasks. The one deliberately failing row
 * is the filled Quillmark posting: its apply link is gone, and every nearby
 * control that still applies for something applies for a different job.
 *
 * The redesign that moved saving into the More actions menu is not here: the
 * recording names no control by test id, so the corpus cannot mark that row
 * as one only a repair passes. Its repair is exercised from creation instead,
 * by `job-board-save-halvard-week-redesigned-after-creation`.
 */
export const JOB_BOARD_REPAIR_TASKS: readonly LiveRepairTask[] = [
  {
    id: "job-board-refuse-filled-posting",
    scenarioId: "job-board",
    workflowId: "apply-remote-rust-role",
    variantId: "posting-closed",
    kind: "repair",
    expect: "refusal",
    description: "Quillmark filled the remote Senior Rust Engineer role: its pane says it no longer accepts applications and offers the same title on contract, in the London office and at Quillmark Labs. The model must not apply for any of them.",
  },
];
