// One changed-read pair (A, B) asked of the tier-2 reevaluator exactly as
// Core's matcher would ask it if a trial sent B's command where the trace
// recorded A (the P5 gate): the request is Core's own
// (`clientGatewayTraceReevaluationRequest`) over A's admission, cursor A, the
// command B's recorded payload, its operation Core's reading of it and the
// fields Core's operation differences of it from A. An answer is compared
// with B's recorded live result (`./answer-comparison.ts`); a gap keeps
// its reason and is never a match.
//
// Not asked, with the reason, where the matcher would not ask either: B has
// no recorded command or no single recorded result to compare with, A's
// recorded command was withheld (`redacted_input`), only fields Core does not
// compare differ (the matcher matches B strictly), or A's segment holds no
// single result to replace. A reevaluator that throws is kept by the error's
// class name: the matcher reads it as a gap.

import { clientGatewayTraceReevaluationRequest, readClientGatewayTraceOperation, type ClientGatewayTraceReevaluator, type ClientGatewayTraceStore } from "fluxiq/client-gateway";
import { compareReadAnswer } from "./answer-comparison.js";
import type { PairOutcome, ReadPair, TraceReads } from "./types.js";

export async function reevaluateReadPair(input: { store: ClientGatewayTraceStore; aTrace: TraceReads; pair: ReadPair; reevaluator: ClientGatewayTraceReevaluator }): Promise<PairOutcome> {
  const { pair, aTrace } = input;
  const live = pair.b.request?.recordedResult;
  const command = pair.b.request?.recordedCommand;
  if (live === undefined) return notAsked("B's segment holds no single readable result, so there is no live result to compare with");
  if (command === undefined || command === null) return notAsked("B's recorded command was withheld or cannot be read back");
  if (pair.a.operation.redacted) return notAsked("A's recorded command was withheld at capture (redacted_input): the matcher never reevaluates it");
  if (pair.fields.length === 0) return notAsked("only fields Core does not compare differ: the matcher matches B to A strictly");
  const manifest = aTrace.admission.manifest;
  if (manifest === null) return notAsked("A's trace was not admitted for matching");
  try {
    const ask = await clientGatewayTraceReevaluationRequest({
      store: input.store, traceId: aTrace.traceId, manifest, operations: aTrace.admission.operations, cursor: pair.a.cursor,
      segment: aTrace.admission.deliveries.segments[pair.a.cursor] ?? [], command, operation: readClientGatewayTraceOperation(command), fields: pair.fields,
    });
    if (ask === undefined) return notAsked("A's segment holds no single readable result to replace");
    const answer = await input.reevaluator.reevaluate(ask.request);
    if (answer.status === "answered") return Object.freeze({ status: "answered", comparison: compareReadAnswer(answer.result, live) });
    if (answer.status === "gap") return Object.freeze({ status: "gap", reason: answer.reason, fields: Object.freeze([...answer.fields]) });
    return Object.freeze({ status: "declined" });
  } catch (error) {
    return Object.freeze({ status: "threw", error: error instanceof Error ? error.constructor.name : typeof error });
  }
}

function notAsked(reason: string): PairOutcome {
  return Object.freeze({ status: "not_asked", reason });
}
