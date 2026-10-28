import type { ScenarioDemonstration } from "@fluxiq-web-extension/test-contracts";
import { CROSSBORDER_MARKETPLACE_DEMONSTRATIONS } from "./crossborder-marketplace/index.js";
import { EVERYTHING_STORE_DEMONSTRATIONS } from "./everything-store/index.js";
import { JOB_BOARD_DEMONSTRATIONS } from "./job-board/index.js";

/**
 * The scripted demonstrations a Lab person records before asking the chat to build a task, gathered from the
 * sites that own them, beside `realistic-site-live-tasks.ts`. Test data for checks that a built Flow did not
 * copy a detour; nothing here is model guidance.
 */
export const REALISTIC_SITE_DEMONSTRATIONS: readonly ScenarioDemonstration[] = [
  ...EVERYTHING_STORE_DEMONSTRATIONS,
  ...CROSSBORDER_MARKETPLACE_DEMONSTRATIONS,
  ...JOB_BOARD_DEMONSTRATIONS,
];
