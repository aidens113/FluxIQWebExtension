// Whether the recorded read's own account proves its list ended where the
// snapshot ends (P5, tier 2). It is what lets an offline read that asked the
// page for more than its control did (D37) -- a held navigation, a scroll past
// the end -- still stand: if the live list had nothing more, the live read
// would not have found more either.
//
// The snapshot was captured after the recorded read ran (D32), so it holds the
// page that read finished on. The proof is the recorded extraction summary,
// read with the wire's own copier (`webAutomationExtractionSummaryValue`) off
// the recorded payload (which reaches the reevaluator untyped and is read as
// data), of a list read that succeeded, saw its list, was not cut short by a
// bound and saw no way on (`listContinues` absent), and whose snapshot holds
// everything it covered:
// - one page read, with no paging stop or one that says the list ended there
//   (`control_disabled`, `no_following_page`); or
// - a read that scrolled to the end (`scrolled_to_end`): scrolling keeps what
//   it loaded in the same document, so the snapshot holds it.
// A read that followed a control to later pages proves nothing: the snapshot
// holds only its last page. Nor does a read stopped by a bound, a failed read,
// or a result with no readable summary.

import type { ClientGatewayTraceRecordedPayload } from "fluxiq/client-gateway";
import { webAutomationExtractionSummaryValue, type WebAutomationExtractionPaginationStop } from "../../actions/extraction";

const ENDED_ON_ITS_PAGE: ReadonlySet<WebAutomationExtractionPaginationStop> = new Set(["control_disabled", "no_following_page"]);

export function webOfflineReadRecordedListEnded(recordedResult: ClientGatewayTraceRecordedPayload): boolean {
  const payload = recordedResult.payload;
  if (recordedResult.status !== "succeeded" || !isRecord(payload) || payload.actionType !== "web.dom.extract_list") return false;
  const summary = webAutomationExtractionSummaryValue(payload.extraction);
  if (summary === undefined || summary.truncated || summary.listContinues !== undefined || summary.listPresence === "never_appeared") return false;
  if (summary.paginationStop === "scrolled_to_end") return true;
  return summary.pagesRead === 1 && (summary.paginationStop === undefined || ENDED_ON_ITS_PAGE.has(summary.paginationStop));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
