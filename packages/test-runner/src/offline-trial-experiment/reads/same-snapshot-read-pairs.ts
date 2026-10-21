// Same-snapshot changed-read pairs (the P5 gate; the P5s survey's
// supplementary pairs): two data reads of the same action, in any traces or
// windows, whose recorded results name the same primary snapshot and whose
// compared commands differ. The tier-2 answer re-reads the very document the
// second live read saw. In store order (trace, then delivery), every pair.

import { clientGatewayTraceOperationDifferences } from "fluxiq/client-gateway";
import { DATA_READ_ACTIONS } from "./data-read-actions.js";
import type { ReadPair, TraceReads } from "./types.js";

export function sameSnapshotReadPairs(traces: readonly TraceReads[]): ReadPair[] {
  const reads = traces.flatMap((trace) => trace.reads.filter((read) => DATA_READ_ACTIONS.has(read.actionType) && read.snapshot !== null));
  const pairs: ReadPair[] = [];
  for (const [index, a] of reads.entries()) {
    for (const b of reads.slice(index + 1)) {
      if (b.snapshot !== a.snapshot || b.actionType !== a.actionType || b.operation.key === a.operation.key) continue;
      pairs.push(Object.freeze({ kind: "same_snapshot", a, b, sameSnapshot: true, fields: Object.freeze(clientGatewayTraceOperationDifferences(b.operation, a.operation)) }));
    }
  }
  return pairs;
}
