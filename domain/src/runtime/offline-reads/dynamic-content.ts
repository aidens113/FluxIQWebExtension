// Whether an offline read met content the snapshot cannot stand for (P5,
// tier 2; reason `dynamic_content`), judged differentially (D37): the recorded
// command is replayed over the same snapshot as a control, beside the changed
// read. A gap, never an answer, when:
// - either run breached the sandbox: a page script ran, or a request left it.
//   The page is no longer the recorded one, whatever the result says;
// - the control did not reproduce the recorded result
//   (`./control-reproduced.ts`): the snapshot is not the page the recorded read
//   saw, so nothing read off it can stand in for a live read;
// - something the changed read needs resolved to nothing: its target was not
//   found or not shown, its wait ran out, or its list never appeared. Live, a
//   script may have rendered it;
// - the changed read asked the page for more than the control did -- more
//   navigations the sandbox held, or more scrolls past the end -- unless the
//   recorded read proves its list ended there (`./recorded-list-ended.ts`).
//   What the control asked for, it was answered with what the recorded read
//   got live; anything beyond that the live page might have loaded.
// A refused request alone is not dynamic (the snapshot did not hold that
// address), and rows a read's conditions excluded are its honest answer.

import type { ClientGatewayTraceRecordedPayload } from "fluxiq/client-gateway";
import { webAutomationExtractionSummaryValue } from "../../actions/extraction";
import type { WebAutomationActionResult } from "../../actions/types";
import { gatewayActionResultFromBrowserResult } from "../../client";
import { WEB_AUTOMATION_FAILURE_CODES } from "../failure";
import { webOfflineReadControlReproduced } from "./control-reproduced";
import { webOfflineReadRecordedListEnded } from "./recorded-list-ended";
import type { WebSnapshotSandboxObservations } from "./snapshot-page";

const UNRESOLVED_TARGET: ReadonlySet<string> = new Set([WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_SHOWN]);

type Run = Readonly<{ result: WebAutomationActionResult; observations: WebSnapshotSandboxObservations }>;

export function webOfflineReadDynamicContent(read: Readonly<{ changed: Run; control: Run; recordedResult: ClientGatewayTraceRecordedPayload }>): boolean {
  const { changed, control, recordedResult } = read;
  if (breached(changed.observations) || breached(control.observations)) return true;
  if (!webOfflineReadControlReproduced(gatewayActionResultFromBrowserResult(control.result), recordedResult)) return true;
  if (changed.result.status === "timed_out") return true;
  if (changed.result.failure !== undefined && UNRESOLVED_TARGET.has(changed.result.failure.code)) return true;
  if (webAutomationExtractionSummaryValue(changed.result.extraction)?.listPresence === "never_appeared") return true;
  const askedMore = changed.observations.navigationsHeld > control.observations.navigationsHeld || changed.observations.scrollsPastEnd > control.observations.scrollsPastEnd;
  return askedMore && !webOfflineReadRecordedListEnded(recordedResult);
}

function breached(observations: WebSnapshotSandboxObservations): boolean {
  return observations.scriptsRan > 0 || observations.requestsLeaked > 0;
}
