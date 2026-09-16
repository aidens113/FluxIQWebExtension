// The confirm path: put the definition in the recording, then run it once.
//
// Both ways into an extraction end here. The user's Confirm arrives with a
// proposal the worker is holding and the columns they kept
// (`control.ts`); the Testing Lab's `fluxiq.test.defineExtraction` arrives with
// a whole definition and no pick at all (X5.3). After validation the two are
// the same thing, so they run the same code and a measurement cannot drift from
// what a person doing it by hand would get.
//
// The order is recording first, then the read. The recorded `data.extract` is
// what a Flow is later built from, and it must land whether or not the read
// succeeds: a page that has just been paginated away, or a list that came up
// short of its minimum, is a failed read of an extraction the user really did
// define. Recording after the read would lose the definition on every such
// failure.
//
// **Nothing read here is stored.** The records go back to the caller in the
// reply and are held nowhere else: not in the session (`session-store.ts` is
// memory-only and drops its preview at `markRecorded`), not in
// `chrome.storage`, and not in the recorded event, which carries the definition
// and counts alone. D3 and D12 both depend on that: the run is the only place a
// value read off the page exists, and an excluded column was never named in the
// request, so no value of one exists at all.

import { webAutomationExtractListTimeoutMs, type WebAutomationRecordedExtraction } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, JsonValue } from "../../shared/protocol";
import { EXTRACTION_CONTENT_MESSAGES, type ExtractionContentMessage, type ExtractionContentResponse } from "../../shared/extraction-messages";
import { runnableExtractListRequest } from "./definition";
import type { ExtractionControlDeps } from "./deps";

/**
 * What a confirmed extraction read, as the control page is told it.
 *
 * `records` is what the page returned and is passed straight through to the one
 * caller that asked; `pagesRead` and `truncated` are the read's account of
 * itself (contract C2), and `durationMs` is how long it took, which is what the
 * Lab measures.
 */
export type ExtractionRunOutcome =
  | { ok: true; records: JsonValue; pagesRead: number; truncated: boolean; durationMs: number }
  | { ok: false; code: ExtractionRunRefusal; message: string };

/**
 * Why an extraction did not run: `invalid_definition`, the domain refuses the
 * definition, so no node could be built from it either; `page_refused`, the
 * frame would not take the recorded event; `run_failed`, the read itself failed
 * or the page could not be reached.
 */
export type ExtractionRunRefusal = "invalid_definition" | "page_refused" | "run_failed";

/**
 * Records `definition` in the recording when one is in progress, then runs it
 * on `tabId`.
 *
 * The recording step is skipped, rather than refused, when nothing is being
 * recorded. That is what lets the Lab drive a read through this seam on a lane
 * that is only replaying; `control.ts` refuses a user's Confirm outside a
 * recording before it ever gets here, because a definition nothing keeps is a
 * silent no-op to the person who confirmed it.
 */
export async function confirmExtraction(
  definition: WebAutomationRecordedExtraction,
  tabId: number,
  options: { readonly sessionId: string; readonly recording: boolean; readonly timeoutMs?: number | undefined },
  deps: ExtractionControlDeps
): Promise<ExtractionRunOutcome> {
  const request = definition.form === "list" ? runnableExtractListRequest(definition) : undefined;
  if (request === undefined) return { ok: false, code: "invalid_definition", message: "The extraction definition is not one the domain can run." };
  if (options.recording) {
    const recorded = await recordDefinition(definition, tabId, options.sessionId, deps);
    if (!recorded.ok) return recorded;
  }
  const action: BrowserActionCommand = {
    commandId: `extraction:${options.sessionId}`,
    actionType: "web.dom.extract_list",
    extractList: request,
    // D14 puts the bound on the command, not the request, and the page waits up
    // to 10,000 ms for *each* page of a list -- so the budget is the domain's,
    // scaled by the pages this request may read. It is imported rather than
    // restated: a flat ceiling here truncated any read past six pages, and two
    // definitions of the same rule would drift apart again.
    timeoutMs: options.timeoutMs ?? webAutomationExtractListTimeoutMs(request),
    tabId,
    frameId: 0
  };
  const startedAt = Date.now();
  try {
    const { result } = await deps.runAction({ action, activeTabId: tabId, attachTabForRecording: (target) => deps.ensureContentScript(target) });
    if (result.status !== "succeeded") {
      return { ok: false, code: "run_failed", message: result.message ?? "The extraction did not run." };
    }
    return {
      ok: true,
      records: result.extracted ?? [],
      pagesRead: result.extraction?.pagesRead ?? 1,
      truncated: result.extraction?.truncated ?? false,
      durationMs: Math.max(0, result.finishedAt - result.startedAt) || Date.now() - startedAt
    };
  } catch (error) {
    return { ok: false, code: "run_failed", message: error instanceof Error ? error.message : "The extraction did not run." };
  }
}

/**
 * Asks the top frame to put `data.extract` in the recording. The frame is the
 * recorder, so the event is sequenced with the clicks and types around it
 * rather than injected beside them from the worker.
 */
async function recordDefinition(
  definition: WebAutomationRecordedExtraction,
  tabId: number,
  sessionId: string,
  deps: ExtractionControlDeps
): Promise<{ ok: true } | { ok: false; code: ExtractionRunRefusal; message: string }> {
  const record: ExtractionContentMessage = { type: EXTRACTION_CONTENT_MESSAGES.record, sessionId, definition };
  try {
    const answer = await deps.sendToTab<ExtractionContentResponse | undefined>(tabId, record, 0);
    if (answer?.ok === true) return { ok: true };
    return { ok: false, code: "page_refused", message: `The page did not record the extraction (${answer?.refused ?? "no answer"}).` };
  } catch (error) {
    return { ok: false, code: "page_refused", message: error instanceof Error ? error.message : "The page did not record the extraction." };
  }
}
