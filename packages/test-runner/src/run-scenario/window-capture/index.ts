// Screenshots of a live Lab run: what the person watching sees -- the page, the
// extension panel and the on-page overlay together -- taken without moving
// focus, bounded so a picture can never fail or hold up the run, and taken
// periodically while the build and the Flow run as well as at the run's own
// moments. `run-scenario.ts` wires the adapter and the periodic scheduler.
export { captureFirstAvailable, type CaptureAttempt, type CaptureSource } from "./capture-first-available.js";
export { ensureWindowCaptureHelper, type WindowCaptureHelperOptions } from "./ensure-window-capture-helper.js";
export { findBrowserProcess, type BrowserProcessEntry } from "./find-browser-process.js";
export { frontTabSource } from "./front-tab-source.js";
export { nativeWindowSource, type NativeWindowSourceInput, type SettledHelper } from "./native-window-source.js";
export { parseProcessList } from "./parse-process-list.js";
export { PeriodicCapture, type PeriodicCaptureInput } from "./periodic-capture.js";
export { createRunScreenshotAdapter, type RunCaptureSession, type RunScreenshotAdapterInput } from "./run-screenshot-adapter.js";
export { runWindowCaptureHelper, type WindowCaptureHelperFailure } from "./run-window-capture-helper.js";
export { withDeadline } from "./with-deadline.js";
export { WINDOW_CAPTURE_SOURCE } from "./window-capture-source.js";
