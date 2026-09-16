// The four messages the background worker sends this frame, read and answered.
//
// `message-handler.ts` routes to `extractionContentMessage`, which says whether
// a message is one of ours and hands back the typed payload, and then to
// `handleExtractionMessage`, which does it. The split is what lets the router
// apply its own rule -- extraction is answered by the top frame only -- without
// knowing anything about picking.
//
// The answer is `{ ok: true }`, with a preview's rows when there are some, or
// `{ ok: false, refused }` naming a reason from a fixed vocabulary. A refusal
// never quotes the page (decision D3): "unreadable_request" is what the worker
// is told when a field resolved to a sensitive control, not which field or what
// it held.

import type { WebAutomationExtractListRequest, WebAutomationRecordedExtraction } from "@fluxiq-web-extension/domain/client";
import {
  EXTRACTION_CONTENT_MESSAGES,
  type ExtractionContentMessage,
  type ExtractionContentResponse
} from "../../shared/extraction-messages";
import { PICKER_PREVIEW_MAX_ROWS, readPreviewRows } from "./preview";
import { recordExtraction } from "./recorded-event";
import { startPick, stopPick } from "./session";

/**
 * What the router does with the message channel afterwards: `answered`, the
 * reply is already sent and the channel may close; `open`, the reply is coming
 * and the listener must return `true` to keep it open.
 */
export type ExtractionHandling = "answered" | "open";

type ContentMessageName = (typeof EXTRACTION_CONTENT_MESSAGES)[keyof typeof EXTRACTION_CONTENT_MESSAGES];

/**
 * `message` as one of the picker's content messages, or `undefined` when it is
 * not one or does not carry what its name requires.
 *
 * A message that names itself one of ours but arrives malformed is not
 * answered at all, which the worker reads as the page refusing -- the same
 * outcome as a frame with no content script, and the one it already handles.
 */
export function extractionContentMessage(message: unknown): ExtractionContentMessage | undefined {
  if (!message || typeof message !== "object") return undefined;
  const typed = message as { type?: unknown; sessionId?: unknown; form?: unknown; request?: unknown; limit?: unknown; definition?: unknown };
  if (typeof typed.type !== "string" || typeof typed.sessionId !== "string") return undefined;
  const name = Object.values(EXTRACTION_CONTENT_MESSAGES).find((candidate) => candidate === typed.type) as ContentMessageName | undefined;
  if (name === undefined) return undefined;
  if (name === EXTRACTION_CONTENT_MESSAGES.pickStart) {
    return { type: name, sessionId: typed.sessionId, form: typed.form === "value" ? "value" : "list" };
  }
  if (name === EXTRACTION_CONTENT_MESSAGES.pickCancel) return { type: name, sessionId: typed.sessionId };
  if (name === EXTRACTION_CONTENT_MESSAGES.record) {
    // The definition is shaped here and read for real by `recordExtraction`,
    // which refuses what the domain would not record.
    return { type: name, sessionId: typed.sessionId, definition: typed.definition as WebAutomationRecordedExtraction };
  }
  return previewMessage(name, typed.sessionId, typed.request, typed.limit);
}

/** Does what the message asks and answers it. */
export function handleExtractionMessage(
  message: ExtractionContentMessage,
  sendResponse: (response: ExtractionContentResponse) => void
): ExtractionHandling {
  if (message.type === EXTRACTION_CONTENT_MESSAGES.pickStart) {
    startPick(message.sessionId, message.form ?? "list");
    sendResponse({ ok: true });
    return "answered";
  }
  if (message.type === EXTRACTION_CONTENT_MESSAGES.pickCancel) {
    stopPick();
    sendResponse({ ok: true });
    return "answered";
  }
  if (message.type === EXTRACTION_CONTENT_MESSAGES.record) {
    // A confirmed extraction ends the pick, if a stray one is somehow still up.
    stopPick();
    const outcome = recordExtraction(message.definition);
    sendResponse(outcome === "recorded" ? { ok: true } : { ok: false, refused: outcome });
    return "answered";
  }
  void readPreviewRows(message.request, message.limit ?? PICKER_PREVIEW_MAX_ROWS)
    .then((rows) => sendResponse({ ok: true, rows }))
    .catch(() => sendResponse({ ok: false, refused: "unreadable_request" }));
  return "open";
}

/** A preview needs a request that at least names an item and a field map; the readers check the rest. */
function previewMessage(name: ContentMessageName, sessionId: string, request: unknown, limit: unknown): ExtractionContentMessage | undefined {
  if (name !== EXTRACTION_CONTENT_MESSAGES.preview) return undefined;
  if (!request || typeof request !== "object") return undefined;
  const typed = request as { item?: unknown; fields?: unknown };
  if (typeof typed.item !== "string" || !typed.fields || typeof typed.fields !== "object") return undefined;
  const read = request as WebAutomationExtractListRequest;
  return typeof limit === "number"
    ? { type: name, sessionId, request: read, limit }
    : { type: name, sessionId, request: read };
}
