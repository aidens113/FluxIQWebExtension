// The ids this bundle registers its options under: the one list every other
// file in this directory names an option by, so a renamed option is renamed
// once and an option that exists nowhere else cannot be referred to.
//
// How Core is told to read one of this domain's refusals, and what a scope
// means here, live beside this in `exploration-terms.ts`: those are read while
// an exploration runs, these are what the bundle is built from.

/** Every option this bundle registers, in the order it registers them. */
export const WEB_RECOVERY_HARNESS_OPTION_IDS = [
  "web.recovery.inspect",
  "web.recovery.reveal",
  "web.recovery.act_safe",
  "web.recovery.wait_for_change",
  "web.recovery.navigate_in_scope",
  "web.recovery.detect_repeating_structure"
] as const;

export type WebRecoveryHarnessOptionId = (typeof WEB_RECOVERY_HARNESS_OPTION_IDS)[number];

export const WEB_RECOVERY_INSPECT_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[0];
export const WEB_RECOVERY_REVEAL_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[1];
export const WEB_RECOVERY_ACT_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[2];
export const WEB_RECOVERY_WAIT_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[3];
export const WEB_RECOVERY_NAVIGATE_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[4];
export const WEB_RECOVERY_DETECT_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[5];
