// Recording and extraction: the top bar's record button, the recording bar,
// the automations tab's "New automation" section, and the review that turns
// a finished recording into an automation. The owner places each element and
// calls `render` with every status.
export { extractControl, type ExtractControl } from "./extract-control";
export { plainWords } from "./plain-words";
export { recordControl, type RecordControl } from "./record-control";
export { createRecordingControls, type RecordingControls } from "./recording-controls";
export {
  createRecordingReview,
  generatedPreview,
  NOTHING_TO_PREVIEW,
  previewOf,
  reduceReview,
  REVIEW_COPY,
  reviewView,
  testOutcome,
  type GeneratedPreview,
  type RecordingReview,
  type ReviewAction,
  type ReviewButton,
  type ReviewEvent,
  type ReviewModel,
  type ReviewPhase,
  type ReviewView,
  type TestOutcome
} from "./review";
