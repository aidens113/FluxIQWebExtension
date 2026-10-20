// The activity status's headline, pacer, clock, fan-out gate and unit readers
// are Core's (`fluxiq/ui`), shared with Core's panel chat; they are re-exported
// here beside the extension-only relay, start/answer sends and overlay target.
export {
  ACTIVITY_DETAIL_INTERVAL_MS,
  ACTIVITY_FAN_OUT_INTERVAL_MS,
  ActivityPacer,
  activityHeadline,
  activityWording,
  FanOutGate,
  systemActivityClock,
  UnitHistory,
  UnitSituation,
  type ActivityClock,
  type ActivityHeadlineSituation,
  type ActivityHostWords,
  type ActivityPacerOptions,
  type ActivityTimer,
  type ActivityWaitReason,
  type ActivityWording,
  type UnitState
} from "fluxiq/ui";
export { ActivityRelay, PAGE_SEND_TIMEOUT_MS, type ActivityRelayDeps } from "./activity-relay";
export { EXTENSION_ACTIVITY_HOST_WORDS } from "./host-words";
export { isActivityOverlayPreference } from "./is-activity-overlay-preference";
export { sendStartedWork } from "./send-answer";
export { SendStart, STARTING_HEADLINE, STARTING_HOLD_MS, type StartingOverride } from "./send-start";
export { OverlayTarget, type OverlayTabCandidate, type OverlayTargetDeps } from "./overlay-target";
export { overlayPreferenceStorage } from "./overlay-preference-storage";
