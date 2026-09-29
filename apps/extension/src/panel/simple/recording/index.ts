// Simple Mode's recording experience (plan 3.3): the steps of the recording in
// progress, each removable, and the review that turns a finished recording
// into an automation. The owner mounts both elements and calls `render` with
// every status.
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
export { createRecordingSteps, reduceSteps, REMOVE_UNSUPPORTED, stepRows, type RecordingSteps, type StepRow, type StepsEvent, type StepsModel } from "./steps";
