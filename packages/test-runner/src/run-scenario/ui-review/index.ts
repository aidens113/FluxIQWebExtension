// A run's UI review: screenshots of the scenario tab and the extension panel,
// and the on-page activity overlay's measured state (`recorder.ts` says why).
// The spine needs the recorder; the rest is exported for the tests that pin each part.
export { captureScenarioTab, type ScenarioTabCaptureInput } from "./capture-scenario-tab.js";
export { chooseScenarioTab, type ChosenScenarioTab, type OpenTab } from "./choose-scenario-tab.js";
export { countOverlayChanges } from "./count-overlay-changes.js";
export { placeCaptureInWindow, type CaptureSpan } from "./place-capture-in-window.js";
export { readOverlaySample, type OverlayCdp } from "./read-overlay-sample.js";
export { sampleOverlayWindow, type OverlayWindowOptions } from "./sample-overlay-window.js";
export { uiReviewPaths } from "./review-paths.js";
export { UiReviewRecorder, type UiReviewRecorderOptions, type UiReviewSession } from "./recorder.js";
export { UiReviewSchedule, type UiReviewScheduleOptions, type UiReviewTimers } from "./schedule.js";
export type { OverlayChangeCounts, OverlaySample, OverlaySampleWindow, UiReviewCapture, UiReviewLabel, UiReviewMoment, UiReviewPhase } from "./types.js";
export { writeUiReviewSidecar, type UiReviewSidecar } from "./write-ui-review-sidecar.js";
