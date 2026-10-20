// The activity display, its wording and the readers of an event's closed fields
// are Core's (`fluxiq/ui`), shared with Core's panel chat; they are re-exported
// here beside the extension-only page messages and activity state.
export {
  ACTIVITY_HISTORY_LIMITS,
  activityAgent,
  activityWording,
  cutAtWord,
  declinedSubmission,
  isHeadlineEcho,
  isInternalStep,
  isModelThought,
  longestWordCut,
  notTriedOutcome,
  projectCard,
  stepRecovery,
  stepSkip,
  type ActivityAgent,
  type ActivityDisplay,
  type ActivityProjectCard,
  type ActivityStepRecovery,
  type ActivityStepSkip,
  type ActivityWording,
  type ClientGatewayActivity,
  type ClientGatewayActivityPhase
} from "fluxiq/ui";
export { ACTIVITY_MESSAGES } from "./activity-messages.js";
export { ACTIVITY_DONE_VISIBLE_MS } from "./done-visible.js";
export {
  ACTIVITY_RECENT_LIMIT,
  type ActivityContentMessage,
  type ActivityOverlayPreference,
  type ExtensionActivityState
} from "./extension-activity-state.js";
