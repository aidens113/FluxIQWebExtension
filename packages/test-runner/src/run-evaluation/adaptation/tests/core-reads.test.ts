import assert from "node:assert/strict";
import test from "node:test";
import { readRunAdaptationMeasurements, type AdaptationReadControl } from "../core-reads.js";

/** A Core that answers the three reads from fixed payloads and records what it was asked. */
function fakeCore(payloads: Record<string, (payload: Record<string, unknown>) => unknown>): AdaptationReadControl & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async automationStudioCall(endpoint, payload) {
      calls.push(`${endpoint}:${String(payload.flowId ?? payload.runId)}${payload.adaptationId ? `:${String(payload.adaptationId)}` : ""}`);
      const answer = payloads[endpoint];
      if (!answer) throw new Error(`unexpected ${endpoint}`);
      return answer(payload);
    },
  };
}

const runDetail = {
  summary: { runId: "run-1", projectId: "p" },
  actionAttempts: [{ nodeId: "save" }],
  subflows: [{ graphFlowId: "graph-sub" }, { graphFlowId: "graph-sub" }],
  interventions: [],
  adaptationIds: [],
};

test("the run's detail, its Flow and each Subflow graph once, then each stamped adaptation, are read and measured", async () => {
  const core = fakeCore({
    "get-flow-run-detail": () => ({ runDetail }),
    "get-flow": ({ flowId }) => ({ flow: { nodes: flowId === "graph-sub" ? [{ id: "save", metadata: { adaptationIds: ["adaptation.a"] } }] : [] } }),
    "get-flow-adaptation": () => ({ adaptation: { status: "applied", riskLevel: "low", validationResults: [], metadata: { baseRevision: 2, appliedRevision: 3 } } }),
  });
  const measured = await readRunAdaptationMeasurements(core, { projectId: "p", flowId: "flow-1", runId: "run-1" });
  assert.deepEqual(core.calls, ["get-flow-run-detail:run-1", "get-flow:flow-1", "get-flow:graph-sub", "get-flow-adaptation:flow-1:adaptation.a"]);
  assert.deepEqual(measured.adaptationReuse?.exercisedAdaptationIds, ["adaptation.a"]);
  assert.deepEqual(measured.adaptationPersistence?.adaptations, [{ adaptationId: "adaptation.a", status: "applied", baseRevision: 2, appliedRevision: 3 }]);
});

test("a run detail for another run, or a payload without its record, throws rather than measuring a partial read", async () => {
  const other = fakeCore({ "get-flow-run-detail": () => ({ runDetail: { ...runDetail, summary: { runId: "run-9", projectId: "p" } } }) });
  await assert.rejects(readRunAdaptationMeasurements(other, { projectId: "p", flowId: "flow-1", runId: "run-1" }), /did not describe the requested run/u);
  const empty = fakeCore({ "get-flow-run-detail": () => ({ runDetail }), "get-flow": () => ({}) });
  await assert.rejects(readRunAdaptationMeasurements(empty, { projectId: "p", flowId: "flow-1", runId: "run-1" }), /carried no flow record/u);
});
