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
  "web.recovery.press",
  "web.recovery.enter_field",
  "web.recovery.wait_for_change",
  "web.recovery.navigate_in_scope",
  "web.recovery.detect_repeating_structure"
] as const;

export type WebRecoveryHarnessOptionId = (typeof WEB_RECOVERY_HARNESS_OPTION_IDS)[number];

export const WEB_RECOVERY_INSPECT_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[0];
// One press option, not two. There used to be `reveal` and `act_safe`, identical
// in schema and differing only in which controls each refused on its own
// judgement; with that judgement gone they were the same option twice.
export const WEB_RECOVERY_PRESS_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[1];
export const WEB_RECOVERY_ENTER_FIELD_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[2];
export const WEB_RECOVERY_WAIT_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[3];
export const WEB_RECOVERY_NAVIGATE_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[4];
export const WEB_RECOVERY_DETECT_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[5];
