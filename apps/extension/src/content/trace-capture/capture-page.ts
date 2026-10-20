// The page capture a traced command asks the top frame for
// (`TRACE_PAGE_CAPTURE_MESSAGE`, `shared/trace-page-capture.ts`): the document
// serialized in one synchronous pass (`serialize-document.ts`), then the
// resources it refers to carried beside it (`carry-resources.ts`).
//
// It never rejects. A capture that cannot be made answers `ok: false` with a
// reason naming the stage and the error's kind -- never its message, which
// can quote the page -- so the traced command's own result still goes out and
// the trace records the capture as missing.

import { TRACE_CAPTURE_BOUNDS } from "./capture-bounds";
import { carryResources } from "./carry-resources";
import { serializeDocument } from "./serialize-document";
import type { TracePageCaptureResponse } from "../../shared/trace-page-capture";
import type { ResourceFetcher, TraceCaptureBounds, TraceResourceCollector } from "./types";

export async function captureTracePage(
  doc: Document = document,
  bounds: TraceCaptureBounds = TRACE_CAPTURE_BOUNDS,
  fetchBytes?: ResourceFetcher
): Promise<TracePageCaptureResponse> {
  let collector: TraceResourceCollector;
  let html: string;
  try {
    collector = { origin: new URL(doc.URL).origin, references: new Map(), unavailable: new Set() };
    html = serializeDocument(doc, collector);
  } catch (error) {
    return { ok: false, reason: failureReason("serializing the document", error) };
  }
  try {
    const carried = await carryResources([...collector.references.values()], bounds, fetchBytes);
    return {
      ok: true,
      document: { html, source: doc.URL },
      resources: carried.resources,
      unavailable: collector.unavailable.size + carried.unavailable
    };
  } catch (error) {
    return { ok: false, reason: failureReason("carrying its resources", error) };
  }
}

function failureReason(stage: string, error: unknown): string {
  const kind = error instanceof Error ? error.name : typeof error;
  return `The page capture failed ${stage}: ${kind}.`;
}
