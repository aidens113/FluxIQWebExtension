// The gateway result a content result becomes: the `client.action_result`
// payload the extension's background answers a live command with, and the one
// the offline reevaluator (`runtime/offline-reads/`) answers a changed read
// with, so both are built by the same code. Moved here from the extension's
// `runtime/result-mapping.ts` (t749); every field below was already a domain
// function's.
//
// Generic over the producer's element and snapshot shapes: the extension's
// `BrowserActionResult` binds them to its DOM descriptors, the domain's own
// result to JSON objects, and both are read through the same domain readers.

import type { ClientGatewayActionResult } from "fluxiq/client-gateway";
import type { JsonObject } from "fluxiq/core";
import { webAutomationClearedCheckWaitValue } from "../actions/cleared-check-wait";
import type { WebAutomationActionResult } from "../actions/types";
import { webAutomationActionTargetFromElement, webAutomationActionVisualTargetFromElement, type WebAutomationElementStateInput } from "../recording/web-state";
import { webAutomationActionResultPayload } from "./gateway-mapping";

export function gatewayActionResultFromBrowserResult(result: WebAutomationActionResult<unknown, unknown>, source?: { tabId?: number | undefined; frameId?: number | undefined }): ClientGatewayActionResult {
  const element = result.element as WebAutomationElementStateInput | undefined;
  const visualTarget = result.visualTarget ?? (element ? webAutomationActionVisualTargetFromElement(element) : undefined);
  return compactObject({
    commandId: result.commandId,
    status: result.status,
    startedAt: result.startedAt,
    completedAt: result.finishedAt,
    clearedWait: webAutomationClearedCheckWaitValue(result.checkWait),
    message: result.message,
    target: element ? webAutomationActionTargetFromElement(element) as unknown as JsonObject : undefined,
    payload: compactObject({
      ...webAutomationActionResultPayload(result as WebAutomationActionResult),
      // Worker-owned context, never a field read from the page's result.
      sourceId: browserSourceId(source?.tabId, source?.frameId),
      visualTarget: visualTarget as unknown as JsonObject
    }) as JsonObject,
    // Every status that is not a success carries its message as the error.
    // `timed_out` and `cancelled` used to reach the gateway with none, while
    // the panel showed the same result as failed with one (found by
    // w1-extension-unit-tests); the status itself is passed through untouched.
    error: result.status === "succeeded" ? undefined : result.message,
    // Core's structured failure record, built by the content script or by a
    // worker-side action. Without this the record was assembled and then
    // dropped at the boundary, so the gateway saw only a message string.
    failure: result.failure
  }) as ClientGatewayActionResult;
}

function browserSourceId(tabId: number | undefined, frameId: number | undefined): string | undefined {
  const frame = frameId ?? 0;
  if (tabId === undefined || !Number.isSafeInteger(tabId) || tabId < 0 || !Number.isSafeInteger(frame) || frame < 0) return undefined;
  return `tab:${tabId}:frame:${frame}`;
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
