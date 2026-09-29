// What follows a recording: turn it into an automation, preview, test, save.
export { generatedPreview, type GeneratedPreview } from "./generated-preview";
export { createRecordingReview, type RecordingReview } from "./recording-review";
export { NOTHING_TO_PREVIEW, previewOf, reduceReview, type ReviewEvent, type ReviewModel, type ReviewPhase } from "./review-model";
export { REVIEW_COPY, reviewView, type ReviewAction, type ReviewButton, type ReviewView } from "./review-view";
export { testOutcome, type TestOutcome } from "./test-outcome";
