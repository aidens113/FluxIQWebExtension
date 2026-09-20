// The web domain's runtime harness options: the five actions Core's exploration
// loop may take on a page, registered into Core's registry rather than built
// into Core. There is no safety ladder here any more: FluxIQ does not refuse a
// control on its own judgement of what it looks like. What stops a lasting act
// is permission, carried and decided by Core -- see the seam in `../press.ts`.
// The two terms Core asks this domain to interpret while an exploration runs --
// how to read a refusal, and what a scope means here -- are exported beside
// the options.
export {
  webAutomationRecoveryHarnessOptionBundle,
  webAutomationRecoveryHarnessOptions
} from "./options";
export { WEB_RECOVERY_WAIT_BOUNDS, type WebRecoveryHarnessContext } from "./execute";
export { webAutomationExplorationRefusalClassifier, webAutomationExplorationScope } from "./exploration-terms";
export {
  WEB_RECOVERY_DETECT_OPTION_ID,
  WEB_RECOVERY_HARNESS_OPTION_IDS,
  WEB_RECOVERY_INSPECT_OPTION_ID,
  WEB_RECOVERY_NAVIGATE_OPTION_ID,
  WEB_RECOVERY_PRESS_OPTION_ID,
  WEB_RECOVERY_WAIT_OPTION_ID,
  type WebRecoveryHarnessOptionId
} from "./vocabulary";
