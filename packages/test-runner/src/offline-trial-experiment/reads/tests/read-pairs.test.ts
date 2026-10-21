// The changed-read pairs the gate asks about: strict pairs (one trace, the
// same page path, nothing acting on the page between), same-snapshot pairs (any
// traces, the same recorded snapshot), one pair per differing-path set, and
// whether an action only observes. Fields are Core's operation differences of
// B's command from A's recorded operation.

import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewayTraceMatcherAdmission, ClientGatewayTraceRecordedOperation } from "fluxiq/client-gateway";
import { isObservingAction } from "../observing-action.js";
import { onePairPerFields } from "../one-pair-per-fields.js";
import { sameSnapshotReadPairs } from "../same-snapshot-read-pairs.js";
import { strictReadPairs } from "../strict-read-pairs.js";
import type { TracedRead, TraceReads } from "../types.js";

function operation(sequence: number, actionType: string, parameters: unknown = {}): ClientGatewayTraceRecordedOperation {
  const compared = { actionType, target: null, parameters };
  return { actionType, compared, key: JSON.stringify(compared), sequence, logicalMs: sequence, commandId: `c${sequence}`, session: "s", redacted: false };
}

function trace(traceId: string, operations: ClientGatewayTraceRecordedOperation[], pages: Record<number, [string, string]>): TraceReads {
  const admission = { manifest: null, refusal: null, sessionRef: "s", claimedView: null, operations, deliveries: { opening: [], segments: [] } } as unknown as ClientGatewayTraceMatcherAdmission;
  const reads: TracedRead[] = operations.flatMap((op, cursor) => isObservingAction(op.actionType) && op.actionType !== "web.dom.capture_snapshot"
    ? [{ traceId, cursor, sequence: op.sequence, actionType: op.actionType, operation: op, urlPath: pages[op.sequence]?.[0] ?? null, snapshot: pages[op.sequence]?.[1] ?? null, request: null }]
    : []);
  return { traceId, activity: "exploration", admission, reads };
}

const LIST = "web.dom.extract_list";

test("only observing actions are reads; navigation, clicks and scrolls act on the page", () => {
  assert.deepEqual(["web.dom.extract_list", "web.dom.extract", "web.dom.capture_snapshot", "web.dom.wait_for_text"].map(isObservingAction), [true, true, true, true]);
  assert.deepEqual(["web.browser.navigate", "web.dom.click", "web.dom.scroll", "web.dom.type"].map(isObservingAction), [false, false, false, false]);
});

test("strict pairs: same trace, action and page path, a different command, nothing acting between", () => {
  const ops = [
    operation(10, LIST, { where: [] }),
    operation(11, "web.dom.capture_snapshot"),
    operation(12, LIST, { where: ["x"] }),
    operation(13, LIST, { where: ["x"] }),
    operation(14, "web.dom.click"),
    operation(15, LIST, { where: ["y"] }),
    operation(16, LIST, { other: true }),
  ];
  const pairs = strictReadPairs(trace("trace.a", ops, { 10: ["/jobs", "s1"], 12: ["/jobs", "s1"], 13: ["/jobs", "s1"], 15: ["/jobs", "s2"], 16: ["/other", "s3"] }));
  assert.deepEqual(pairs.map((pair) => [pair.kind, pair.a.sequence, pair.b.sequence, pair.sameSnapshot, pair.fields]), [
    ["strict", 10, 12, true, ["parameters.where"]],
    ["strict", 10, 13, true, ["parameters.where"]],
  ]);
});

test("same-snapshot pairs reach across traces and windows, never pairing equal commands or different actions", () => {
  const first = trace("trace.a", [operation(1, LIST, { a: 1 }), operation(2, "web.browser.navigate"), operation(3, LIST, { a: 2 }), operation(4, "web.dom.extract", { a: 2 })], { 1: ["/p", "s1"], 3: ["/p", "s1"], 4: ["/p", "s1"] });
  const second = trace("trace.b", [operation(7, LIST, { a: 1 }), operation(8, LIST, { a: 3 })], { 7: ["/p", "s1"], 8: ["/p", "s9"] });
  const pairs = sameSnapshotReadPairs([first, second]);
  assert.deepEqual(pairs.map((pair) => [pair.kind, pair.a.traceId, pair.a.sequence, pair.b.traceId, pair.b.sequence, pair.fields]), [
    ["same_snapshot", "trace.a", 1, "trace.a", 3, ["parameters.a"]],
    ["same_snapshot", "trace.a", 3, "trace.b", 7, ["parameters.a"]],
  ]);
});

test("one pair per differing-path set, the first of each, up to a cap", () => {
  const ops = [operation(1, LIST, { a: 1, b: 1 }), operation(2, LIST, { a: 2, b: 1 }), operation(3, LIST, { a: 3, b: 1 }), operation(4, LIST, { a: 1, b: 2 })];
  const pairs = strictReadPairs(trace("trace.a", ops, { 1: ["/p", "s"], 2: ["/p", "s"], 3: ["/p", "s"], 4: ["/p", "s"] }));
  assert.deepEqual(onePairPerFields(pairs, 25).map((pair) => [pair.a.sequence, pair.b.sequence, pair.fields.join(",")]), [
    [1, 2, "parameters.a"], [1, 4, "parameters.b"], [2, 4, "parameters.a,parameters.b"],
  ]);
  assert.equal(onePairPerFields(pairs, 2).length, 2);
});
