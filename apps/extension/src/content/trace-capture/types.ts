// The shapes the trace page capture passes between its own modules. The
// message and its reply are `shared/trace-page-capture.ts`; these never leave
// the content script.

/**
 * A resource the serialized document refers to and the capture carries,
 * keyed by the address the document requests it at.
 *
 * - `fetch`: a same-origin image or stylesheet, carried as the bytes the
 *   server sends for it (`fetch-resource-bytes.ts`), never re-encoded.
 * - `inline`: a same-origin frame's document, serialized here by the same
 *   rules as the page, so it carries no script and withholds what the page
 *   does.
 */
export type TraceResourceReference =
  | { kind: "fetch"; source: string }
  | { kind: "inline"; source: string; mediaType: string; text: string };

/**
 * What a serialization pass found the document referring to: the resources to
 * carry, by address, in document order, and the addresses it refers to that
 * cannot be carried (cross-origin, or a scheme a request cannot be answered
 * at), each counted once.
 */
export type TraceResourceCollector = {
  /** The top document's origin; only an http(s) address of this origin is carried. */
  origin: string;
  references: Map<string, TraceResourceReference>;
  unavailable: Set<string>;
};

/** The bounds a capture's resources are carried under (`capture-bounds.ts`). */
export type TraceCaptureBounds = {
  /** The most bytes one resource may carry; a larger one is counted unavailable. */
  resourceBytes: number;
  /** The most bytes all resources together may carry; one that would pass it is counted unavailable. */
  totalResourceBytes: number;
  /** How long one fetch may take before it is given up and counted unavailable. */
  fetchTimeoutMs: number;
  /** How long carrying every resource may take; one not fetched by then is counted unavailable. */
  captureDeadlineMs: number;
  /** How many fetches run at once. */
  fetchConcurrency: number;
};

/** What one fetch of a resource came to: its bytes as the server sent them, or why there are none. */
export type FetchedResource =
  | { carried: true; mediaType: string; bytes: Uint8Array }
  | { carried: false; why: "status" | "too-large" | "timeout" | "failed" };

/** Fetches one address within the byte and time limits given; never rejects. */
export type ResourceFetcher = (address: string, limits: { maxBytes: number; timeoutMs: number }) => Promise<FetchedResource>;
