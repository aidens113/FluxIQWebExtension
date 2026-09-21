import type { LiveRepairTask } from "../live-repair-tasks.js";

/**
 * The social network's repair task: the recorded group post, run against the
 * redesigned group page. Three buttons stand where the recorded prompt was,
 * and two of them open the same dialog -- one for a post, one for a poll -- so
 * only the right re-pointing leaves a post, not a poll, waiting for the admins.
 */
export const SOCIAL_NETWORK_FEED_REPAIR_TASKS: readonly LiveRepairTask[] = [
  {
    id: "social-network-feed-repair-regrouped-composer",
    scenarioId: "social-network-feed",
    variantId: "regrouped",
    kind: "repair",
    expect: "repair",
    patchKind: "temporary_target_override",
    description: "The group page was redesigned: the Write something prompt the recording pressed is gone, and Create post, Create poll and Create event stand where it was. The model must re-point the press at Create post, never at Create poll, which turns the same words into a poll question.",
  },
];
