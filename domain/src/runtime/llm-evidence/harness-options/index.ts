// The web domain's runtime harness options: the five actions Core's exploration
// loop may take on a page, registered into Core's registry rather than built
// into Core. The safety ladder is exported because it is the decision decision
// L3 governs, and a reader looking for "what stops it clicking Delete" should
// find it named rather than buried in a tool implementation.
export {
  webAutomationRecoveryHarnessOptionBundle,
  webAutomationRecoveryHarnessOptions
} from "./options";
export { WEB_RECOVERY_WAIT_BOUNDS, type WebRecoveryHarnessContext } from "./execute";
export {
  webRecoverySafeActionVerdict,
  WEB_RECOVERY_COMMITTING_WORDS,
  WEB_RECOVERY_DISMISSAL_WORDS,
  type WebRecoveryActionSignal,
  type WebRecoveryActionVerdict,
  type WebRecoverySafetyRung
} from "./safety";
export {
  webAutomationExplorationRefusalClassifier,
  webAutomationExplorationScope,
  WEB_RECOVERY_ACT_OPTION_ID,
  WEB_RECOVERY_HARNESS_OPTION_IDS,
  WEB_RECOVERY_INSPECT_OPTION_ID,
  WEB_RECOVERY_NAVIGATE_OPTION_ID,
  WEB_RECOVERY_REVEAL_OPTION_ID,
  WEB_RECOVERY_WAIT_OPTION_ID,
  type WebRecoveryHarnessOptionId
} from "./vocabulary";
