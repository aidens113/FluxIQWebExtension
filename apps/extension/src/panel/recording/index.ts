// Recording and extraction: the top bar's record button, the recording bar,
// the automations tab's "New automation" section, and the review that offers a
// finished recording to the next message or to FluxIQ. The owner places each element and
// calls `render` with every status.
export { extractControl, type ExtractControl } from "./extract-control";
export { plainWords } from "./plain-words";
export { recordControl, type RecordControl } from "./record-control";
export { createRecordingControls, type RecordingControls } from "./recording-controls";
export { ATTACH_NEXT_LABEL, createRecordingReview, type RecordingReview, type RecordingReviewOptions } from "./review";
