import { EVERYTHING_STORE_LIVE_TASKS } from "./everything-store/index.js";
import { CROSSBORDER_MARKETPLACE_LIVE_TASKS } from "./crossborder-marketplace/index.js";
import { BIGBOX_RETAIL_LIVE_TASKS } from "./bigbox-retail/index.js";
import { JOB_BOARD_LIVE_TASKS } from "./job-board/index.js";
import { LOCAL_CLASSIFIEDS_LIVE_TASKS } from "./local-classifieds/index.js";
import { AUCTION_MARKETPLACE_LIVE_TASKS } from "./auction-marketplace/index.js";
import { PHOTO_SOCIAL_LIVE_TASKS } from "./photo-social/index.js";
import { SOCIAL_NETWORK_FEED_TASKS } from "./social-network-feed/index.js";
import { COMPANY_WEBSITE_LIVE_TASKS } from "./company-website/index.js";
import { PROFESSIONAL_NETWORK_LIVE_TASKS } from "./professional-network/index.js";
import type { LiveInstructionTask } from "./live-instructions.js";

/**
 * The ten realistic sites' live instruction tasks, in the order the corpus
 * lists them. Each site owns its tasks in its own `live-tasks.ts`, beside the
 * manifest they are judged by; this list only gathers them, so the corpus
 * (`live-instructions.ts`) takes a new site as one line here rather than two
 * of its own.
 */
export const REALISTIC_SITE_LIVE_TASKS: readonly LiveInstructionTask[] = [
  ...EVERYTHING_STORE_LIVE_TASKS,
  ...CROSSBORDER_MARKETPLACE_LIVE_TASKS,
  ...BIGBOX_RETAIL_LIVE_TASKS,
  ...JOB_BOARD_LIVE_TASKS,
  ...LOCAL_CLASSIFIEDS_LIVE_TASKS,
  ...AUCTION_MARKETPLACE_LIVE_TASKS,
  ...PHOTO_SOCIAL_LIVE_TASKS,
  ...SOCIAL_NETWORK_FEED_TASKS,
  ...COMPANY_WEBSITE_LIVE_TASKS,
  ...PROFESSIONAL_NETWORK_LIVE_TASKS,
];
