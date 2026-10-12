// A batch of claims answered from this document in one synchronous pass, with
// no wait (plan B1). The background worker sends a frame its share of a batch
// once (`runtime/fact-check-runner.ts`); this answers every claim in it, in
// order, before the message channel closes.
//
// Two things make a whole batch `unknown` before any claim is judged: a
// document other than the one the asker last saw (`stale_document`), since
// every claim was about a page that is gone, and a claim that cannot be read
// off the wire (`unsupported`, for that claim only). A claim whose reading
// throws is `unknown` (`capture_failed`) on its own; the rest are still
// judged. Everything else is the judge's (`judge.ts`).

import type { WebAutomationFactAnswer, WebAutomationFactCheckReading, WebAutomationFactCheckResult } from "@fluxiq-web-extension/domain/client";
import type { FactPage } from "./fact-page";
import { judgeFact } from "./judge";

export function evaluateFactBatch(reading: WebAutomationFactCheckReading, page: FactPage, now: () => number = Date.now): WebAutomationFactCheckResult {
  const document = page.document();
  const capturedAt = now();
  const described = { url: document.url, readyState: document.readyState, ...(document.timeOrigin === undefined ? {} : { timeOrigin: document.timeOrigin }) };
  const stale = reading.documentTimeOrigin !== undefined && document.timeOrigin !== undefined && reading.documentTimeOrigin !== document.timeOrigin;
  const answers = reading.queries.map((query): WebAutomationFactAnswer => {
    if (stale) return { result: "unknown", evidence: { reason: "stale_document" }, capturedAt };
    if (!query) return { result: "unknown", evidence: { reason: "unsupported" }, capturedAt };
    try {
      return judgeFact(query, page, capturedAt, document.readyState);
    } catch {
      // Reading this claim threw -- a selector the page cannot parse, a node
      // gone mid-read. Nothing was observed, so nothing is claimed.
      return { result: "unknown", evidence: { reason: "capture_failed" }, capturedAt };
    }
  });
  return { answers, document: described };
}
