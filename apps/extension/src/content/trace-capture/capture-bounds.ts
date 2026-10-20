// The bounds every trace page capture carries its resources under.
//
// The reply travels as one extension message, serialized as JSON, with every
// resource base64 (a third larger than its bytes); Chrome refuses a message
// past 64 MiB. Core's object store takes at most 20 MB an object. So one
// resource carries at most 4 MiB and all of them together 16 MiB -- about
// 21 MiB as base64, well inside one message. The page document itself is not
// bounded: it is the capture, and the spike measured 32 to 193 KB of it on the
// realistic sites (lane T U3).
//
// Time: a fetch is given 5 s and the whole carry 15 s, so a resource that
// stalls costs the traced command a bounded wait and is counted unavailable
// rather than holding the command's result. Six fetches run at once, the
// connection count a browser keeps to one host.

import type { TraceCaptureBounds } from "./types";

export const TRACE_CAPTURE_BOUNDS: TraceCaptureBounds = {
  resourceBytes: 4 * 1024 * 1024,
  totalResourceBytes: 16 * 1024 * 1024,
  fetchTimeoutMs: 5_000,
  captureDeadlineMs: 15_000,
  fetchConcurrency: 6
};
