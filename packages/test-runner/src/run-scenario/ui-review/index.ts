// A run's UI review: screenshots of the scenario tab and the extension panel,
// and the on-page activity overlay's measured state (`recorder.ts` says why).
// The capture helpers stay internal; the spine needs the recorder, and the tests the parts they pin.
export { countOverlayChanges } from "./count-overlay-changes.js";
export { placeCaptureInWindow, type CaptureSpan } from "./place-capture-in-window.js";
export { readOverlaySample, type OverlayCdp } from "./read-overlay-sample.js";
export { sampleOverlayWindow, type OverlayWindowOptions } from "./sample-overlay-window.js";
export { uiReviewPaths } from "./review-paths.js";
export { UiReviewRecorder, type UiReviewRecorderOptions, type UiReviewSession } from "./recorder.js";
export { UiReviewSchedule, type UiReviewScheduleOptions, type UiReviewTimers } from "./schedule.js";
export type { OverlayChangeCounts, OverlaySample, OverlaySampleWindow, UiReviewCapture, UiReviewLabel, UiReviewMoment, UiReviewPhase } from "./types.js";
export { writeUiReviewSidecar, type UiReviewSidecar } from "./write-ui-review-sidecar.js";
