// Asks a tab's top frame for the page capture (`TRACE_PAGE_CAPTURE_MESSAGE`,
// answered by `content/trace-capture/`), within a time limit, and reads the
// answer.
//
// It never rejects. No answer in time, a frame with no script, or an answer
// that is not the capture's shape all come back `ok: false` with a reason
// naming what happened -- the error's kind, never its message, which could
// quote the page -- so the caller counts the capture unavailable and the
// traced command's result still goes out.

import { TRACE_PAGE_CAPTURE_MESSAGE, type TracePageCaptureMessage, type TracePageCaptureResource, type TracePageCaptureResponse } from "../../shared/trace-page-capture";
import type { TraceMessageSender } from "./types";
import { withinTime } from "./within-time";

/** The id the browser always gives a tab's main frame. */
const TOP_FRAME_ID = 0;

export async function requestPageCapture(send: TraceMessageSender, tabId: number, timeoutMs: number): Promise<TracePageCaptureResponse> {
  const message: TracePageCaptureMessage = { type: TRACE_PAGE_CAPTURE_MESSAGE, frameId: TOP_FRAME_ID };
  let answer: unknown;
  try {
    answer = await withinTime(send(tabId, message, TOP_FRAME_ID), timeoutMs, "The page capture");
  } catch (error) {
    return { ok: false, reason: `The page capture was not answered: ${error instanceof Error ? error.name : typeof error}.` };
  }
  return readReply(answer);
}

function readReply(answer: unknown): TracePageCaptureResponse {
  const reply = objectOf(answer);
  if (reply?.ok === false) return { ok: false, reason: typeof reply.reason === "string" ? reply.reason : "The page could not be captured." };
  const document = objectOf(reply?.document);
  if (reply?.ok !== true || typeof document?.html !== "string" || typeof document.source !== "string" || !Array.isArray(reply.resources)) {
    return { ok: false, reason: "The page capture's answer was not a capture." };
  }
  const resources: TracePageCaptureResource[] = [];
  let unreadable = 0;
  for (const value of reply.resources) {
    const resource = objectOf(value);
    if (typeof resource?.source === "string" && typeof resource.mediaType === "string" && typeof resource.base64 === "string") {
      resources.push({ source: resource.source, mediaType: resource.mediaType, base64: resource.base64 });
    } else {
      unreadable += 1;
    }
  }
  const unavailable = typeof reply.unavailable === "number" && Number.isInteger(reply.unavailable) && reply.unavailable >= 0 ? reply.unavailable : 0;
  return { ok: true, document: { html: document.html, source: document.source }, resources, unavailable: unavailable + unreadable };
}

function objectOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
