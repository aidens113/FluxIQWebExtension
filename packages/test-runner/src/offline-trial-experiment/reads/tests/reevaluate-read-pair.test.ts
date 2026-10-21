// A changed-read pair asked as Core's matcher asks: Core's own request over
// A's admission at A's cursor, B's recorded command, Core's differences; the
// answer compared with B's live result, a gap kept as a gap, and the pairs the
// matcher would never ask about left unasked with the reason.

import assert from "node:assert/strict";
import test from "node:test";
import { readClientGatewayTraceOperation, type ClientGatewayTraceMatcherAdmission, type ClientGatewayTraceReevaluationRequest, type ClientGatewayTraceReevaluator, type ClientGatewayTraceStore } from "fluxiq/client-gateway";
import { reevaluateReadPair } from "../reevaluate-read-pair.js";
import type { ReadPair, TracedRead, TraceReads } from "../types.js";

const LIST = "web.dom.extract_list";
const commandA = { commandId: "cA", actionType: LIST, parameters: { extractList: { item: "li", fields: { name: "b" }, minItems: 0 } } };
const commandB = { commandId: "cB", actionType: LIST, parameters: { extractList: { item: "li", fields: { name: "b" }, minItems: 0, where: [{ field: "name", equals: "x" }] } } };
const resultA = { commandId: "cA", status: "succeeded", payload: { extracted: [{ name: "x" }, { name: "y" }], extraction: { recordCount: 2, pagesRead: 1, itemsSeen: 2 } } };
const liveB = { commandId: "cB", status: "succeeded", payload: { extracted: [{ name: "x" }], extraction: { recordCount: 1, pagesRead: 1, itemsSeen: 2 } } };

const opA = { ...readClientGatewayTraceOperation(commandA), sequence: 10, logicalMs: 10, commandId: "cA", session: "s", redacted: false };
const opB = { ...readClientGatewayTraceOperation(commandB), sequence: 20, logicalMs: 20, commandId: "cB", session: "s", redacted: false };

const store = {
  readEventRange: async (_traceId: string, from: number) => from === 10 ? [{ sequence: 10, redactions: [], payload: { encoding: "json", value: { type: "server.execute_action", payload: commandA } } }] : [],
  readArtifact: async () => undefined,
} as unknown as ClientGatewayTraceStore;

const segmentA = [{ kind: "input", atMs: 11, event: { sequence: 11, messageType: "client.action_result", redactions: [], payload: { encoding: "text", text: JSON.stringify({ type: "client.action_result", payload: resultA }) } } }];
const aTrace: TraceReads = {
  traceId: "trace.a", activity: "exploration",
  admission: { manifest: { traceId: "trace.a", artifacts: [] }, refusal: null, sessionRef: "s", claimedView: null, operations: [opA, opB], deliveries: { opening: [], segments: [segmentA, []] } } as unknown as ClientGatewayTraceMatcherAdmission,
  reads: [],
};
const readA: TracedRead = { traceId: "trace.a", cursor: 0, sequence: 10, actionType: LIST, operation: opA, urlPath: "/p", snapshot: "s1", request: null };
const readB: TracedRead = { traceId: "trace.a", cursor: 1, sequence: 20, actionType: LIST, operation: opB, urlPath: "/p", snapshot: "s1", request: { recordedCommand: commandB, recordedResult: liveB } as unknown as ClientGatewayTraceReevaluationRequest };
const pair: ReadPair = { kind: "strict", a: readA, b: readB, sameSnapshot: true, fields: ["parameters.extractList.where"] };

test("the request is Core's at A's cursor with B's command and Core's fields, and an answer is compared with B's live result", async () => {
  const asked: ClientGatewayTraceReevaluationRequest[] = [];
  const reevaluator: ClientGatewayTraceReevaluator = {
    reevaluate: async (request) => {
      asked.push(request);
      return { status: "answered", result: { ...liveB, commandId: "offline", startedAt: 99 } };
    },
  };
  const outcome = await reevaluateReadPair({ store, aTrace, pair, reevaluator });
  assert.equal(outcome.status, "answered");
  assert.equal(outcome.status === "answered" && outcome.comparison.equal, true);
  const [request] = asked;
  assert.deepEqual([request?.command, request?.fields, request?.recorded.sequence, request?.recordedCommand, request?.recordedResult], [commandB, ["parameters.extractList.where"], 10, commandA, resultA]);
});

test("an answer that differs from B's live result is a difference, and a gap stays a gap", async () => {
  const differs = await reevaluateReadPair({ store, aTrace, pair, reevaluator: { reevaluate: async () => ({ status: "answered", result: resultA }) } });
  assert.equal(differs.status === "answered" && differs.comparison.equal, false);
  const gap = await reevaluateReadPair({ store, aTrace, pair, reevaluator: { reevaluate: async () => ({ status: "gap", reason: "dynamic_content", fields: ["parameters.extractList.where"] }) } });
  assert.deepEqual(gap, { status: "gap", reason: "dynamic_content", fields: ["parameters.extractList.where"] });
  const throwing: ClientGatewayTraceReevaluator = {
    reevaluate: async () => {
      throw new TypeError("page content in message");
    },
  };
  const thrown = await reevaluateReadPair({ store, aTrace, pair, reevaluator: throwing });
  assert.deepEqual(thrown, { status: "threw", error: "TypeError" });
});

test("pairs the matcher would not ask about are not asked, with the reason", async () => {
  const never: ClientGatewayTraceReevaluator = { reevaluate: async () => assert.fail("asked") };
  const cases: [ReadPair, RegExp][] = [
    [{ ...pair, b: { ...readB, request: null } }, /no live result/u],
    [{ ...pair, b: { ...readB, request: { recordedCommand: null, recordedResult: liveB } as unknown as ClientGatewayTraceReevaluationRequest } }, /withheld/u],
    [{ ...pair, a: { ...readA, operation: { ...opA, redacted: true } } }, /redacted_input/u],
    [{ ...pair, fields: [] }, /strictly/u],
  ];
  for (const [given, reason] of cases) {
    const outcome = await reevaluateReadPair({ store, aTrace, pair: given, reevaluator: never });
    assert.equal(outcome.status, "not_asked");
    assert.match(outcome.status === "not_asked" ? outcome.reason : "", reason);
  }
});
