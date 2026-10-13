import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import { applyLiveRepair, assertRepairPersisted, type RepairApplication } from "../apply-repair.js";

/**
 * Core's promotion gates ask for evidence, and a named reviewer's approval is
 * one of the two things that satisfies them. So the Lab approves and then
 * applies, and what it records is the status Core left behind -- never the
 * sentence Core refuses with, which names the gates in prose.
 *
 * An `applied` status is Core's word, not a measurement of the Flow. So the
 * Flow itself is read either side of the review, and an applied repair that
 * left its steps unchanged fails (adaptation plan G1, gate P4).
 */

type Call = { endpoint: string; action?: string; adaptationId?: string };
type Stored = { status: string; baseRevision?: number; appliedRevision?: number; applicationRecord?: unknown };

const SAVE = { id: "save", definitionId: "builtin.policy.action", parameterValues: { outputId: "web.dom.click", parameters: { target: { accessibleName: "Add to cart" } } } };
const REPOINTED = { ...SAVE, parameterValues: { outputId: "web.dom.click", parameters: { target: { accessibleName: "Add to basket" } } } };

/**
 * A fake Core holding a Flow and its Subflow graph. An accepted `apply`
 * re-points the save node on the graph `applyTo` names, unless `inert`, and
 * always moves the parent's `updatedAt` and metadata stamp, as Core's legacy
 * apply does: the steps are what tell a real change from a stamp.
 */
function core(options: { statuses?: Record<string, Stored[]>; refuse?: (call: Call) => boolean; inert?: boolean; applyTo?: "parent" | "graph" } = {}) {
  const calls: Call[] = [];
  const cursors = new Map<string, number>();
  const flows: Record<string, { flowId: string; updatedAt: number; metadata: Record<string, unknown>; nodes: unknown[]; edges: unknown[] }> = {
    "flow-1": { flowId: "flow-1", updatedAt: 1, metadata: {}, nodes: [SAVE], edges: [] },
    "graph-1": { flowId: "graph-1", updatedAt: 1, metadata: { parentFlowId: "flow-1" }, nodes: [SAVE], edges: [] },
  };
  return {
    calls,
    flows,
    control: {
      automationStudioCall: async (endpoint: string, payload: Record<string, unknown>) => {
        const adaptationId = String(payload.adaptationId);
        const call: Call = { endpoint, ...(payload.adaptationId ? { adaptationId } : {}), ...(payload.action ? { action: String(payload.action) } : {}) };
        calls.push(call);
        if (options.refuse?.(call)) throw new Error("Adaptation cannot be applied: no succeeded trial and no reviewer approval");
        if (endpoint === "get-flow") return { flow: structuredClone(flows[String(payload.flowId)]) };
        if (endpoint === "list-flow-subflows") return { subflows: [{ subflowId: "subflow-1", graphFlowId: "graph-1" }] };
        if (endpoint === "get-flow-adaptation") {
          const line = options.statuses?.[adaptationId] ?? [{ status: "proposed", baseRevision: 3 }, { status: "applied", baseRevision: 3, appliedRevision: 4 }];
          const at = cursors.get(adaptationId) ?? 0;
          cursors.set(adaptationId, at + 1);
          const stored = line[Math.min(at, line.length - 1)]!;
          return { adaptation: { adaptationId, status: stored.status, metadata: { phase9: { baseRevision: stored.baseRevision, appliedRevision: stored.appliedRevision }, ...(stored.applicationRecord ? { applicationRecord: stored.applicationRecord } : {}) } } };
        }
        if (endpoint === "review-flow-adaptation" && payload.action === "apply") {
          const parent = flows["flow-1"]!;
          parent.updatedAt += 1;
          parent.metadata = { appliedAdaptationIds: [adaptationId] };
          if (!options.inert) flows[options.applyTo === "parent" ? "flow-1" : "graph-1"]!.nodes = [REPOINTED];
        }
        return { adaptation: { adaptationId } };
      },
    },
  };
}

const failureOf = (application: RepairApplication): RunnerFailure => {
  try {
    assertRepairPersisted(application);
  } catch (error) {
    if (error instanceof RunnerFailure) return error;
    throw error;
  }
  assert.fail("the persistence check passed");
};

test("a saved adaptation is approved, then applied, and the statuses and revisions either side are recorded", async () => {
  const fake = core();
  const application = await applyLiveRepair(fake.control, { projectId: "project-1", flowId: "flow-1", adaptationIds: ["adaptation-1"] });
  assert.equal(application.outcome, "applied");
  assert.deepEqual(application.adaptations, [{ adaptationId: "adaptation-1", statusBefore: "proposed", approved: true, applyAccepted: true, statusAfter: "applied", alreadyApplied: false, refusedBy: null, baseRevision: 3, appliedRevision: 4, changeRecorded: "revision" }]);
  assert.deepEqual(fake.calls.filter((call) => call.adaptationId).map((call) => `${call.endpoint}${call.action ? `:${call.action}` : ""}`), [
    "get-flow-adaptation", "review-flow-adaptation:approve", "review-flow-adaptation:apply", "get-flow-adaptation",
  ]);
});

test("the saved Flow is read before the first review and after the last, and a repair that moved its steps reads as changed", async () => {
  const fake = core();
  const application = await applyLiveRepair(fake.control, { projectId: "project-1", flowId: "flow-1", adaptationIds: ["adaptation-1"] });
  const flow = application.flow;
  assert.ok(flow, "an applied repair carries no Flow evidence");
  assert.equal(flow.change, "changed");
  assert.notEqual(flow.before.stepsHash, flow.after.stepsHash);
  assert.notEqual(flow.before.contentHash, flow.after.contentHash);
  // The parent first, then each Subflow graph: Core writes a node patch onto the Subflow's graph Flow, not the parent.
  assert.deepEqual(flow.after.graphs.map((graph) => [graph.flowId, graph.updatedAt]), [["flow-1", 2], ["graph-1", 1]]);
  assert.match(flow.before.contentHash, /^[0-9a-f]{64}$/u);
  const reads = fake.calls.map((call) => call.endpoint);
  assert.ok(reads.indexOf("get-flow") < reads.indexOf("review-flow-adaptation"), "the Flow was not read before the review");
  assert.ok(reads.lastIndexOf("get-flow") > reads.lastIndexOf("review-flow-adaptation"), "the Flow was not read after the review");
  assert.doesNotThrow(() => assertRepairPersisted(application));
});

test("a node patch on the parent Flow is seen too", async () => {
  const fake = core({ applyTo: "parent" });
  const application = await applyLiveRepair(fake.control, { projectId: "project-1", flowId: "flow-1", adaptationIds: ["adaptation-1"] });
  assert.equal(application.flow?.change, "changed");
});

test("an applied repair that changed only the Flow's stamp and timestamp, not its steps, fails as unpersisted", async () => {
  const fake = core({ inert: true });
  const application = await applyLiveRepair(fake.control, { projectId: "project-1", flowId: "flow-1", adaptationIds: ["adaptation-1"] });
  assert.equal(application.outcome, "applied");
  assert.equal(application.flow?.change, "unchanged");
  assert.notEqual(application.flow?.before.contentHash, application.flow?.after.contentHash, "the stamp alone moves the content hash");
  assert.equal(application.flow?.before.stepsHash, application.flow?.after.stepsHash);
  const failure = failureOf(application);
  assert.equal(failure.category, "runtime.behavior");
  assert.equal(failure.message, "Core reported the repair applied, but the saved Flow's steps are unchanged: the repair was not kept in the Flow");
  assert.deepEqual(failure.details?.flowChange, "unchanged");
});

test("an adaptation Core already applied is left alone, still counts as applied, and its own revision record proves the change", async () => {
  const fake = core({ statuses: { "adaptation-1": [{ status: "applied", baseRevision: 3, appliedRevision: 4 }] } });
  const application = await applyLiveRepair(fake.control, { projectId: "project-1", flowId: "flow-1", adaptationIds: ["adaptation-1"] });
  assert.equal(application.outcome, "applied");
  assert.equal(application.adaptations[0]?.alreadyApplied, true);
  assert.equal(application.adaptations[0]?.approved, false);
  assert.equal(application.adaptations[0]?.changeRecorded, "revision");
  assert.deepEqual(fake.calls.filter((call) => call.adaptationId).map((call) => call.endpoint), ["get-flow-adaptation"], "an executed patch is not reviewed again");
  // Core changed the Flow inside the run, before the lane's first read, so the lane's own hashes are equal and say nothing.
  assert.equal(application.flow?.change, "changed_in_run");
  assert.equal(application.flow?.before.stepsHash, application.flow?.after.stepsHash);
  assert.doesNotThrow(() => assertRepairPersisted(application));
});

test("an in-run apply recorded only by Core's legacy mutation record is proved by that record's own before and after", async () => {
  const record = { mutations: [
    { patchKind: "edit_action_target", artifactKind: "flow", before: { flowId: "graph-1", nodes: [SAVE], edges: [] }, after: { flowId: "graph-1", nodes: [REPOINTED], edges: [] } },
    { patchKind: "promote_adaptation", artifactKind: "flow", before: { flowId: "flow-1", nodes: [], edges: [] }, after: { flowId: "flow-1", nodes: [], edges: [], metadata: { appliedAdaptationIds: ["adaptation-1"] } } },
  ] };
  const fake = core({ statuses: { "adaptation-1": [{ status: "applied", baseRevision: 3, appliedRevision: 3, applicationRecord: record }] } });
  const application = await applyLiveRepair(fake.control, { projectId: "project-1", flowId: "flow-1", adaptationIds: ["adaptation-1"] });
  assert.equal(application.adaptations[0]?.changeRecorded, "mutation");
  assert.equal(application.flow?.change, "changed_in_run");
});

test("an in-run apply that neither the Flow nor Core's record shows changing anything is unproven, and fails", async () => {
  const stampOnly = { mutations: [{ patchKind: "promote_adaptation", artifactKind: "flow", before: { flowId: "flow-1", nodes: [], edges: [] }, after: { flowId: "flow-1", nodes: [], edges: [], metadata: { x: 1 } } }] };
  for (const stored of [{ status: "applied", baseRevision: 3, appliedRevision: 3 }, { status: "applied", baseRevision: 3, applicationRecord: stampOnly }, { status: "applied" }]) {
    const fake = core({ statuses: { "adaptation-1": [stored] } });
    const application = await applyLiveRepair(fake.control, { projectId: "project-1", flowId: "flow-1", adaptationIds: ["adaptation-1"] });
    assert.equal(application.adaptations[0]?.changeRecorded, null);
    assert.equal(application.flow?.change, "unseen_in_run");
    assert.match(failureOf(application).message, /^Core applied the repair inside the run, and neither the saved Flow nor Core's record of 1 adaptation\(s\) shows the Flow changing/u);
  }
});

test("an applied record with no Flow evidence at all is unproven, never passed", () => {
  const failure = failureOf({ outcome: "applied", adaptations: [] });
  assert.match(failure.message, /no record of the saved Flow before and after/u);
});

test("a refused or absent repair is not judged here", () => {
  assert.doesNotThrow(() => assertRepairPersisted({ outcome: "no_proposal", adaptations: [] }));
  assert.doesNotThrow(() => assertRepairPersisted({ outcome: "not_applied", adaptations: [] }));
});

test("a run that saved no adaptation applies nothing, and that is not a failure", async () => {
  const fake = core();
  const application = await applyLiveRepair(fake.control, { projectId: "project-1", flowId: "flow-1", adaptationIds: [] });
  assert.equal(application.outcome, "no_proposal");
  assert.deepEqual(application.adaptations, []);
  assert.equal(application.flow, undefined);
  assert.deepEqual(fake.calls, [], "a refusal task must not cost a Core call");
});

test("a refused review is reported by category, not swallowed, and the rest are still attempted", async () => {
  const fake = core({
    statuses: { "adaptation-1": [{ status: "proposed", baseRevision: 3 }], "adaptation-2": [{ status: "proposed", baseRevision: 3 }, { status: "applied", baseRevision: 3, appliedRevision: 4 }] },
    refuse: (call) => call.adaptationId === "adaptation-1" && call.action === "apply",
  });
  const application = await applyLiveRepair(fake.control, { projectId: "project-1", flowId: "flow-1", adaptationIds: ["adaptation-1", "adaptation-2"] });
  assert.equal(application.outcome, "not_applied");
  assert.equal(application.adaptations[0]?.approved, true);
  assert.equal(application.adaptations[0]?.applyAccepted, false);
  assert.equal(application.adaptations[0]?.statusAfter, "proposed");
  assert.ok(application.adaptations[0]?.refusedBy, "a refused apply left no record of the failure");
  assert.equal(application.adaptations[1]?.statusAfter, "applied", "the second adaptation was not attempted");
  assert.equal(JSON.stringify(application).includes("no succeeded trial"), false, "the record carries Core's refusal sentence");
});

test("a status read that fails is not caught: a lane that cannot see what it did reports nothing applied", async () => {
  const control = { automationStudioCall: async () => { throw new Error("run detail unavailable"); } };
  await assert.rejects(applyLiveRepair(control, { projectId: "project-1", flowId: "flow-1", adaptationIds: ["adaptation-1"] }), /run detail unavailable/u);
});

test("a Flow read that returns no Flow is not measured as one", async () => {
  const fake = core();
  const control = { automationStudioCall: async (endpoint: string, payload: Record<string, unknown>) => (endpoint === "get-flow" ? {} : fake.control.automationStudioCall(endpoint, payload)) };
  await assert.rejects(applyLiveRepair(control, { projectId: "project-1", flowId: "flow-1", adaptationIds: ["adaptation-1"] }), /Core's get-flow payload carried no Flow/u);
});

test("an adaptation id that is not an identifier is refused before it is reviewed", async () => {
  const fake = core();
  await assert.rejects(
    applyLiveRepair(fake.control, { projectId: "project-1", flowId: "flow-1", adaptationIds: ["adaptation 1; drop"] }),
    /Core named an adaptation whose id is not an identifier/u,
  );
  assert.deepEqual(fake.calls, []);
});
