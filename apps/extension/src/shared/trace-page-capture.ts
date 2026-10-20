// The message the background worker sends the top frame to capture the page
// for a traced command (traces and offline trials, P2), and the reply's shape.
// Both ends name it from here, so the string cannot drift between
// `background/trace-capture/` and `content/message-handler.ts`.
//
// The capture is a DOM serialization served later at its original address
// (lane T U3): the document with live form state, open shadow roots as
// declarative templates, CSSOM styles inlined, raw attributes, scripts and
// inline handlers stripped, and sensitive values withheld by the same rule the
// action results use. Resources it refers to (same-origin stylesheets, images,
// frame documents) come back as their original bytes, base64, each keyed by the
// absolute address the browser requests for it (the document's own attributes
// stay raw, so offline it is served at its original address and asks for the
// same keys); same-origin frame documents are serialized by the same pass, not
// fetched, so their live state is kept. Nothing here ever reaches a run, a
// recording or a model: the background uploads it to Core's trace store and
// references it from the result's `metadata.trace` only.

export const TRACE_PAGE_CAPTURE_MESSAGE = "fluxiq.tracePageCapture";

export type TracePageCaptureMessage = {
  type: typeof TRACE_PAGE_CAPTURE_MESSAGE;
  /** The frame the message is for, checked by the frame as `executeAction`'s address is. */
  frameId?: number | undefined;
};

/** One resource the document refers to, as its original bytes. */
export type TracePageCaptureResource = {
  /** The absolute address the browser requests for it. */
  source: string;
  mediaType: string;
  base64: string;
};

export type TracePageCaptureResponse =
  | {
      ok: true;
      document: { html: string; source: string };
      resources: TracePageCaptureResource[];
      /** Resources the document refers to that could not be carried (cross-origin, failed fetch, too large). */
      unavailable: number;
    }
  | { ok: false; reason: string };
