// Recording and extraction: "Show me how" in the chat composer, the recording bar,
// the automations tab's "New automation" section, and the review that offers a
// finished recording to the next message. A recording that ends attaches itself to
// the next message. The owner places each element and calls `render` with every status.
export { attachFinishedRecording, FINISHED_TIMING, type FinishedRecordingDeps, type FinishedRecordingTiming } from "./attach-finished";
export { createPendingRecordingStore, parsePendingRecording, PENDING_RECORDING_KEY, type PendingRecording, type PendingRecordingStore } from "./pending-recording-store";
export { extractControl, type ExtractControl } from "./extract-control";
export { plainWords } from "./plain-words";
export { recordControl, type RecordControl } from "./record-control";
export { createRecordingControls, POPUP_BAR_LINE, type RecordingControls, type RecordingControlsOptions } from "./recording-controls";
export { createRecordingFinish, NOT_ATTACHED_LINE, SAVING_LINE, type RecordingFinish, type RecordingFinishHost } from "./finished-line";
export { ATTACH_NEXT_LABEL, createRecordingReview, type RecordingReview, type RecordingReviewOptions } from "./review";
