// A command the browser lost in flight (plan B3, Core C8): which acts commit,
// what an interrupted one is reported as, and how the output dispatcher reads it.
export { webAutomationActionCommits } from "./commits";
export { webAutomationInterruptedDispatchReading } from "./dispatch-reading";
export { webAutomationInterruptedOutcome, type WebAutomationInterruptedOutcome } from "./outcome";
export { WEB_AUTOMATION_INTERRUPTED_STATUS, webAutomationInterruptedActionResult, type WebAutomationInFlightCommand } from "./result";
