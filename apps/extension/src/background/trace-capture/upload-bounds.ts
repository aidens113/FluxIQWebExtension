// The bounds a traced command's page capture and its uploads are held to.
//
// The traced command's own result waits for them, so each is bounded and a
// part that runs out of time is counted unavailable rather than holding the
// result. The page carries its resources for at most 15 s
// (`content/trace-capture/capture-bounds.ts`) after a serialization the spike
// measured at under 0.2 s, so the top frame gets 18 s to answer. Uploads then
// get 10 s in all, 10 s each, four at a time: the document is tens of
// kilobytes and the resources are the page's own, mostly already stored by an
// earlier command (`page-capturer.ts` skips those).

import type { TraceUploadBounds } from "./types";

export const TRACE_UPLOAD_BOUNDS: TraceUploadBounds = {
  captureTimeoutMs: 18_000,
  uploadTimeoutMs: 10_000,
  uploadDeadlineMs: 10_000,
  uploadConcurrency: 4
};
