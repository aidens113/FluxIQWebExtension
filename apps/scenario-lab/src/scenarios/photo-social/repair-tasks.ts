import type { LiveRepairTask } from "../live-repair-tasks.js";

/**
 * Framelight's repair task: the recorded collection Flow against the consent
 * vendor's redesign, where the control it pressed is gone and the pressable
 * alternative that kept its test id is the wrong answer.
 */
export const PHOTO_SOCIAL_REPAIR_TASKS: readonly LiveRepairTask[] = [
  {
    id: "photo-social-repair-consent-redesign",
    scenarioId: "photo-social",
    variantId: "consent-redesign",
    kind: "repair",
    expect: "repair",
    patchKind: "temporary_target_override",
    description: "The cookie dialog moved to a new consent vendor: Decline optional cookies is gone, Only allow essential cookies does its job with no test id, and Allow all cookies kept its test id and moved first. The model must re-point the press at Only allow essential cookies, never at Allow all cookies, which the final state refuses.",
  },
];
