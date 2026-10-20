// The page side of a traced command's page capture (traces and offline
// trials, P2): the document serialized as it stands, with live form state,
// open shadow roots, the CSSOM's styles and raw attributes, no script, and
// sensitive values withheld by the action results' rule; and the resources it
// refers to as their original bytes. `capture-page.ts` is the entry the
// message handler calls; the background uploads the reply to Core's trace
// store, and nothing here reaches a run, a recording or a model.
export { captureTracePage } from "./capture-page";
export { TRACE_CAPTURE_BOUNDS } from "./capture-bounds";

export type { TraceCaptureBounds } from "./types";
