// Strict changed-read pairs in one trace (the P5 gate; the P5s survey's
// definition): two data reads (`web.dom.extract_list`, `web.dom.extract`) of
// the same action, on the same page path, whose compared commands differ
// (Core's operation key), with no operation that acts on the page between
// them (`./observing-action.ts`). In delivery order, every such pair.

import { clientGatewayTraceOperationDifferences } from "fluxiq/client-gateway";
import { DATA_READ_ACTIONS } from "./data-read-actions.js";
import { isObservingAction } from "./observing-action.js";
import type { ReadPair, TraceReads } from "./types.js";

export function strictReadPairs(trace: TraceReads): ReadPair[] {
  const operations = trace.admission.operations;
  const reads = trace.reads.filter((read) => DATA_READ_ACTIONS.has(read.actionType));
  const pairs: ReadPair[] = [];
  for (const [index, a] of reads.entries()) {
    for (const b of reads.slice(index + 1)) {
      if (operations.slice(a.cursor + 1, b.cursor).some((between) => !isObservingAction(between.actionType))) break;
      if (b.actionType !== a.actionType || a.urlPath === null || b.urlPath !== a.urlPath || b.operation.key === a.operation.key) continue;
      pairs.push(Object.freeze({ kind: "strict", a, b, sameSnapshot: a.snapshot !== null && a.snapshot === b.snapshot, fields: Object.freeze(clientGatewayTraceOperationDifferences(b.operation, a.operation)) }));
    }
  }
  return pairs;
}
