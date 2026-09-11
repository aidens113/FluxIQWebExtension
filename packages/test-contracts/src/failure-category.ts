/**
 * The automation failure taxonomy, re-exported from Core.
 *
 * Core owns the one category list (plan decision D11): it names every member,
 * classifies failed attempts into them, and drops any failure record that
 * contradicts itself. This package keeps no list of its own, so a scenario
 * expectation, a run manifest, and a run evaluation all name a failure exactly
 * as the runtime reports it. Every facility package reaches Core's taxonomy
 * through this module rather than depending on `@fluxiq/contracts` itself.
 *
 * `AutomationStudioFailureRecord` is the structured failure a producer reports
 * (`category`, producer-owned `code`, `retryable`, and an optional stage and
 * evidence); `parseAutomationStudioFailureRecord` is the only way to read one
 * that crossed the wire.
 */
export {
  AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES,
  isAutomationStudioAdaptiveFailureClass,
  parseAutomationStudioFailureRecord,
  type AutomationStudioAdaptiveFailureClass,
  type AutomationStudioFailureRecord,
} from "@fluxiq/contracts/automation-studio";
