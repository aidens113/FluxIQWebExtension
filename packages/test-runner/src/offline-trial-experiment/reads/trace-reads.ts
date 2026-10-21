// The reads one trace recorded (the P5 gate), read through Core's exported
// matcher seams only: the trace admitted for matching exactly as Core's
// offline runner admits it (`admitClientGatewayTraceForMatching` with the
// reader contracts the runner speaks), and for each read -- an action the
// domain classifies as observing (`./observing-action.ts`), the builder's page
// view (`web.dom.capture_snapshot`) aside -- the request Core's matcher would
// build at its cursor (`clientGatewayTraceReevaluationRequest`), which carries
// its recorded command and its one recorded result. A refused trace has no
// reads; a read whose segment holds no single readable result keeps `request:
// null`.

import { AUTOMATION_STUDIO_OFFLINE_TRIAL_READER_CONTRACTS } from "fluxiq/automation-studio";
import { admitClientGatewayTraceForMatching, clientGatewayTraceReevaluationRequest, type ClientGatewayTraceStore } from "fluxiq/client-gateway";
import { isObservingAction } from "./observing-action.js";
import { recordedPage } from "./recorded-page.js";
import type { TracedRead, TraceReads } from "./types.js";

const PAGE_VIEW = "web.dom.capture_snapshot";

export async function readTraceReads(input: { store: ClientGatewayTraceStore; traceId: string }): Promise<TraceReads> {
  const admission = await admitClientGatewayTraceForMatching({ store: input.store, traceId: input.traceId, contractVersions: AUTOMATION_STUDIO_OFFLINE_TRIAL_READER_CONTRACTS });
  const manifest = admission.manifest;
  const reads: TracedRead[] = [];
  if (admission.refusal === null && manifest !== null) {
    for (const [cursor, operation] of admission.operations.entries()) {
      if (operation.actionType === PAGE_VIEW || !isObservingAction(operation.actionType)) continue;
      const ask = await clientGatewayTraceReevaluationRequest({
        store: input.store, traceId: input.traceId, manifest, operations: admission.operations, cursor,
        segment: admission.deliveries.segments[cursor] ?? [], command: {}, operation, fields: [],
      });
      const request = ask === undefined ? null : ask.request;
      const page = recordedPage(request?.recordedResult);
      reads.push(Object.freeze({ traceId: input.traceId, cursor, sequence: operation.sequence, actionType: operation.actionType, operation, urlPath: page.urlPath, snapshot: page.snapshot, request }));
    }
  }
  return Object.freeze({ traceId: input.traceId, activity: manifest?.activity ?? "unknown", admission, reads: Object.freeze(reads) });
}
