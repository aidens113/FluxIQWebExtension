// The background route of a fact check (plan B1): one gateway command in, one
// answer per claim out, with no wait anywhere on the way.
//
// The claims are grouped by the frame they are about and each frame is sent
// its group once, concurrently, as `fluxiq.evaluateFacts`; the page answers
// synchronously. So a batch costs one message per frame it names -- one, for
// the usual batch about the top document -- and the gateway sees one command.
//
// Nothing here waits for a page to be ready, re-injects a content script or
// retries a send: each of those is a wait, and a fact check reads the page as
// it stands. A frame that does not answer -- no tab, no content script, a
// document between navigations -- answers every claim it was asked
// `unknown` (`unreadable_frame`); a reply that is not an answer to the claims
// sent is `unknown` (`capture_failed`). Neither is ever `false`.

import {
  webAutomationFactCheckResultValue,
  type WebAutomationFactAnswer,
  type WebAutomationFactCheckReading,
  type WebAutomationFactCheckResult,
  type WebAutomationFactQuery,
  type WebAutomationFactUnknownReason
} from "@fluxiq-web-extension/domain/client";
import { FACT_CHECK_MESSAGE, type FactCheckContentMessage } from "../shared/fact-check-message";

/** The id the browser always gives a tab's main frame. */
const TOP_FRAME_ID = 0;

export type FactCheckRunDeps = {
  /** The tab the run stands on, or `undefined` when there is none. */
  tabId: number | undefined;
  send(tabId: number, message: FactCheckContentMessage, frameId: number): Promise<unknown>;
  now?: () => number;
};

export async function runFactCheck(reading: WebAutomationFactCheckReading, deps: FactCheckRunDeps): Promise<WebAutomationFactCheckResult> {
  const now = deps.now ?? Date.now;
  const answers: WebAutomationFactAnswer[] = reading.queries.map(() => unknown("unsupported", now()));
  const frames = new Map<number, { index: number; query: WebAutomationFactQuery }[]>();
  reading.queries.forEach((query, index) => {
    if (!query) return;
    const frameId = query.frameId ?? TOP_FRAME_ID;
    frames.set(frameId, [...(frames.get(frameId) ?? []), { index, query }]);
  });
  const tabId = deps.tabId;
  let document: WebAutomationFactCheckResult["document"];
  await Promise.all([...frames].map(async ([frameId, group]) => {
    const answered = tabId === undefined ? UNREADABLE_FRAME : await askFrame(deps, tabId, frameId, group.map((entry) => entry.query), reading.documentTimeOrigin, now);
    group.forEach((entry, position) => {
      answers[entry.index] = answered === UNREADABLE_FRAME
        ? unknown("unreadable_frame", now())
        : answered.answers[position] ?? unknown("capture_failed", now());
    });
    if (frameId === TOP_FRAME_ID && answered !== UNREADABLE_FRAME && answered.document) document = answered.document;
  }));
  return document === undefined ? { answers } : { answers, document };
}

/** No script answered in the frame, or there was no tab to ask. */
const UNREADABLE_FRAME = "unreadable_frame";

/**
 * One frame's answers, aligned with the claims sent, or `UNREADABLE_FRAME`
 * when the frame did not answer. A reply of the wrong length answers every claim
 * `capture_failed`: it is an answer, but not to these claims.
 */
async function askFrame(
  deps: FactCheckRunDeps,
  tabId: number,
  frameId: number,
  queries: WebAutomationFactQuery[],
  documentTimeOrigin: number | undefined,
  now: () => number
): Promise<WebAutomationFactCheckResult | typeof UNREADABLE_FRAME> {
  // The document identity is the top document's; a child frame is another document.
  const request = { queries, ...(frameId === TOP_FRAME_ID && documentTimeOrigin !== undefined ? { documentTimeOrigin } : {}) };
  let reply: unknown;
  try {
    reply = await deps.send(tabId, { type: FACT_CHECK_MESSAGE, frameId, request }, frameId);
  } catch {
    // "Receiving end does not exist" and its kin: no script answered in this
    // frame, so nothing in it was read.
    return UNREADABLE_FRAME;
  }
  const result = webAutomationFactCheckResultValue(reply, now());
  if (result && result.answers.length === queries.length) return result;
  return { answers: queries.map(() => unknown("capture_failed", now())), ...(result?.document ? { document: result.document } : {}) };
}

function unknown(reason: WebAutomationFactUnknownReason, capturedAt: number): WebAutomationFactAnswer {
  return { result: "unknown", evidence: { reason }, capturedAt };
}
