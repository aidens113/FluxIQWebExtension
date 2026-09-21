import assert from "node:assert/strict";
import test from "node:test";
import type { RunHarnessRecovery } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../../failure.js";
import { createdFlowSecretInputs } from "../../creation/index.js";
import { runLiveRepairLane, type LiveRepairLaneInput } from "../run-repair-lane.js";
import type { ProveLiveRepairControl } from "../prove-repair.js";

/**
 * The lane end to end, against a fake Core: approve, apply, replay, publish,
 * judge. The two outcomes that matter most are at the ends of it -- a repair
 * that replays without the model passes, and a refusal task that proposed
 * nothing passes without applying or replaying anything.
 */

const RECOVERED: RunHarnessRecovery = {
  attempted: true,
  interventions: [{ kind: "runtime_patch", validationOk: true, validationCodes: [] }],
  runtimePatchAttempts: [{ kind: "temporary_target_override", proposalOnly: true, executed: false, preflightOk: true, issueCodes: [], adaptationCreated: true, changeProposalCreated: true }],
  adaptationIds: ["adaptation-1"],
  changeProposalIds: ["proposal-1"],
};

const REFUSED: RunHarnessRecovery = {
  attempted: true,
  interventions: [{ kind: "diagnosis", validationOk: true, validationCodes: [] }],
  runtimePatchAttempts: [],
  adaptationIds: [],
  changeProposalIds: [],
};

const attempt = { attemptId: "attempt.one", nodeId: "node.one", definitionId: "web.dom.click", order: 0, status: "succeeded", startedAt: 1_000, finishedAt: 1_030 };

/** What the recovery's proposal pointed at, as Core's adaptation stores it: the page's one submit control. */
const APPLY_CHANGES = { tagName: "button", accessibleName: "Apply changes", metadata: { controlType: "submit" } };

function lane(options: { recovery?: RunHarnessRecovery; replays?: number; applyRefused?: boolean; providerCalls?: number; goal?: boolean; target?: Record<string, unknown>; nodes?: unknown[] } = {}) {
  const endpoints: string[] = [];
  const written: Array<{ path: string; value: any }> = [];
  const published: Record<string, unknown>[] = [];
  const reset: number[] = [];
  let applied = false;
  const control = {
    selectExistingContext: async () => undefined,
    startPersistedFlow: async () => ({ runId: "run.replay" }),
    runPersistedFlow: async () => ({ session: { runId: "run.replay", status: "succeeded" } }),
    getRunDetail: async () => ({
      summary: { runId: "run.replay", projectId: "project-1", flowId: "flow-1", status: "succeeded", routeDecisionCount: 0, subflowEntryCount: 0, actionAttemptCount: 1, updatedAt: 1 },
      routeDecisions: [], subflows: [], actionAttempts: [], interventions: [],
      ...(options.providerCalls === undefined ? {} : { providerCallCount: options.providerCalls }),
    }),
    automationStudioCall: async (endpoint: string, payload: Record<string, unknown>) => {
      endpoints.push(endpoint + (payload.action ? `:${String(payload.action)}` : ""));
      if (endpoint === "get-flow") return { flow: { nodes: options.nodes ?? [] } };
      if (endpoint === "list-flow-subflows") return { subflows: [] };
      if (endpoint === "get-flow-adaptation") return { adaptation: { adaptationId: "adaptation-1", status: applied ? "applied" : "proposed", proposalId: "proposal-1", patch: [{ kind: "edit_action_target", after: options.target ?? APPLY_CHANGES }] } };
      if (endpoint === "review-flow-adaptation") {
        if (payload.action === "apply") {
          if (options.applyRefused) throw new RunnerFailure("environment.missing", "Automation Studio call failed: review-flow-adaptation");
          applied = true;
        }
        return { adaptation: { adaptationId: "adaptation-1" } };
      }
      return { runDetail: { summary: { runId: "run.replay", status: "succeeded" }, actionAttempts: [attempt], interventions: [] } };
    },
  } as unknown as ProveLiveRepairControl;
  const input: LiveRepairLaneInput = {
    ...(options.replays === undefined ? {} : { replays: options.replays }),
    live: { repairsFlow: true, describeRepair: () => ({ task: "repair", purpose: "explore_and_adapt" }) },
    lane: { flowId: "flow-1", run: { harnessRecovery: options.recovery ?? RECOVERED } },
    projectId: "project-1", facilityRunId: "run-lab", scenarioId: "identity-drift",
    secrets: [], steps: [],
    scenarioOrigin: "http://127.0.0.1:1/", runToken: "token",
    prepare: async () => undefined,
    checkGoal: async () => options.goal ?? true,
    bundle: { writeStructured: async (path: string, value: unknown) => { written.push({ path, value }); } },
    publish: async (details: Record<string, unknown>) => { published.push(details); },
  };
  // The reset is the lane's own and goes through `fetch`; the fixture origin is
  // unreachable, so it is replaced rather than served.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { reset.push(reset.length + 1); return { ok: true, status: 204 }; }) as unknown as typeof fetch;
  return { control, input, endpoints, written, published, reset, restore: () => { globalThis.fetch = originalFetch; } };
}

test("a repair is approved, applied and replayed, and the proof is published before it is judged", async (t) => {
  const fake = lane({ replays: 2 });
  t.after(fake.restore);
  const proof = await runLiveRepairLane(fake.control, fake.input);
  assert.ok(proof);
  assert.equal(proof.task, "repair");
  assert.equal(proof.purpose, "explore_and_adapt");
  assert.equal(proof.application.outcome, "applied");
  assert.equal(proof.replaysRequested, 2);
  assert.deepEqual(proof.replays.map((replay) => [replay.outcome, replay.providerCalls, replay.goalPassed]), [["ran", 0, true], ["ran", 0, true]]);
  assert.deepEqual(fake.reset, [1, 2], "each replay resets the fixture before arming it");
  assert.deepEqual(fake.written.map((entry) => entry.path), ["snapshots/repair-lane.json"]);
  assert.equal(fake.written[0]?.value.application.outcome, "applied");
  assert.deepEqual(fake.published[0]?.application, "applied");
  assert.ok(fake.endpoints.includes("review-flow-adaptation:approve"));
  assert.ok(fake.endpoints.includes("review-flow-adaptation:apply"));
});

test("a refusal task proposed nothing, so nothing is applied, nothing is replayed, and the run does not fail", async (t) => {
  const fake = lane({ replays: 2, recovery: REFUSED });
  t.after(fake.restore);
  const proof = await runLiveRepairLane(fake.control, fake.input);
  assert.ok(proof);
  assert.equal(proof.application.outcome, "no_proposal");
  assert.deepEqual(proof.replays, []);
  assert.deepEqual(fake.reset, [], "a refusal task must not replay");
  assert.equal(fake.endpoints.filter((endpoint) => endpoint.startsWith("review-flow-adaptation")).length, 0);
  assert.equal(fake.written[0]?.value.application.outcome, "no_proposal");
});

test("without --replays the lane does nothing at all", async (t) => {
  const fake = lane({});
  t.after(fake.restore);
  assert.equal(await runLiveRepairLane(fake.control, fake.input), undefined);
  assert.deepEqual(fake.endpoints, []);
  assert.deepEqual(fake.written, []);
});

test("a provider-free run has no repair to apply, whatever --replays says", async (t) => {
  const fake = lane({ replays: 1 });
  t.after(fake.restore);
  const { live: _live, ...withoutLive } = fake.input;
  assert.equal(await runLiveRepairLane(fake.control, withoutLive), undefined);
  assert.deepEqual(fake.endpoints, []);
});

test("--replays 0 applies the repair and proves nothing, which is what it says", async (t) => {
  const fake = lane({ replays: 0 });
  t.after(fake.restore);
  const proof = await runLiveRepairLane(fake.control, fake.input);
  assert.equal(proof?.application.outcome, "applied");
  assert.deepEqual(proof?.replays, []);
  assert.deepEqual(fake.reset, []);
});

test("a repair Core would not apply fails the run, and the evidence is written first", async (t) => {
  const fake = lane({ replays: 1, applyRefused: true });
  t.after(fake.restore);
  await assert.rejects(
    runLiveRepairLane(fake.control, fake.input),
    (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && /could not be applied: 1 adaptation\(s\) ended proposed rather than applied \(a review was refused: environment.missing\)/u.test(error.message),
  );
  assert.equal(fake.written[0]?.value.application.outcome, "not_applied", "the proof was not published before the judgement");
  assert.deepEqual(fake.reset, [], "a repair that was not applied must not be replayed");
});

test("a replay that called the model fails the run as the thing it is: a repair that is not deterministic", async (t) => {
  const fake = lane({ replays: 2, providerCalls: 1 });
  t.after(fake.restore);
  await assert.rejects(
    runLiveRepairLane(fake.control, fake.input),
    (error: unknown) => error instanceof RunnerFailure && /is not deterministic: 2 of 2 replay\(s\) called the model/u.test(error.message),
  );
  assert.equal(fake.written[0]?.value.replays.length, 2);
});

test("a replay whose goal did not hold fails the run, naming the replays that missed it", async (t) => {
  const fake = lane({ replays: 1, goal: false });
  t.after(fake.restore);
  await assert.rejects(
    runLiveRepairLane(fake.control, fake.input),
    (error: unknown) => error instanceof RunnerFailure && /did not hold: 1 of 1 replay\(s\) did not reach the fixture's expected final state/u.test(error.message),
  );
});

/**
 * A Flow FluxIQ built from an instruction: its playback ran under the
 * proposal-only repair grant, so its repair is the same kind of proposal, and
 * its own lane judged no declared repair, so this lane judges it first.
 */
const DECLARED = { patchKind: "temporary_target_override", target: { tagName: "button", accessibleName: "Apply changes", controlType: "submit" } } as const;
function createdLane(options: Parameters<typeof lane>[0] = {}) {
  const fake = lane(options);
  const input: LiveRepairLaneInput = {
    ...fake.input, expectation: DECLARED,
    // The created lane's own rule, as the runner hands it in.
    rebuildInputs: (nodes) => createdFlowSecretInputs({ scenarioId: fake.input.scenarioId, secrets: fake.input.secrets, workflow: { recordingScript: [] }, nodes }),
    live: { repairsFlow: true, describeRepair: () => ({ task: "create-flow", purpose: "diagnose_and_adapt" }) },
  };
  return { ...fake, input };
}

test("a created Flow's proposal is judged against the declared repair, then applied and replayed under the grant that made it", async (t) => {
  const fake = createdLane({ replays: 1 });
  t.after(fake.restore);
  const proof = await runLiveRepairLane(fake.control, fake.input);
  assert.deepEqual([proof?.task, proof?.purpose, proof?.application.outcome], ["create-flow", "diagnose_and_adapt", "applied"]);
  assert.deepEqual(proof?.replays.map((replay) => [replay.outcome, replay.providerCalls, replay.goalPassed]), [["ran", 0, true]]);
  assert.equal(fake.written[0]?.value.declaredRepair.verdict, "repaired");
  assert.equal(fake.published[0]?.declaredRepair, "repaired");
  // Judged before the review: the adaptation is read, then approved, then applied.
  assert.ok(fake.endpoints.indexOf("get-flow-adaptation") < fake.endpoints.indexOf("review-flow-adaptation:approve"));
});

test("a created Flow's proposal naming another control, or no proposal, is never applied or replayed", async (t) => {
  const wrong = createdLane({ replays: 1, target: { tagName: "button", accessibleName: "Discard changes", metadata: { controlType: "button" } } });
  t.after(wrong.restore);
  await assert.rejects(
    runLiveRepairLane(wrong.control, wrong.input),
    (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && /not the declared one: its proposal named a different control \(accessibleName, controlType differ\)/u.test(error.message),
  );
  assert.equal(wrong.endpoints.some((endpoint) => endpoint.startsWith("review-flow-adaptation")), false, "a wrong proposal must not be approved onto the Flow");
  assert.deepEqual(wrong.reset, []);
  assert.deepEqual([wrong.written[0]?.value.declaredRepair.verdict, wrong.written[0]?.value.application, wrong.written[0]?.value.replays], ["wrong_target", null, []], "the judgement is written before the run fails");
  assert.deepEqual(wrong.published[0], { declaredRepair: "wrong_target", application: null });

  // A refusal is not the declared repair either: a created Flow that failed and proposed nothing does not pass as repaired.
  const none = createdLane({ replays: 1, recovery: REFUSED });
  t.after(none.restore);
  await assert.rejects(runLiveRepairLane(none.control, none.input), /not the declared one: no temporary_target_override was proposed/u);
  assert.equal(none.endpoints.some((endpoint) => endpoint.startsWith("review-flow-adaptation")), false);
});

test("a created Flow's run inputs are rebuilt by the rule its caller hands in, here the created lane's, which refuses a Flow asking for files before anything is applied", async (t) => {
  const uploading = { id: "node.upload", definitionId: "web.output.dom-upload", parameterValues: { selector: "#file", upload: { $state: { path: "web.upload.file" } } }, metadata: { outputActionId: "web.dom.upload" } };
  const fake = createdLane({ replays: 1, nodes: [uploading] });
  t.after(fake.restore);
  await assert.rejects(runLiveRepairLane(fake.control, fake.input), /asks the run for files on 1 node\(s\)/u);
  assert.equal(fake.endpoints.some((endpoint) => endpoint.startsWith("review-flow-adaptation")), false);
  // The recorded rule reads a node's nested parameters only, so the same flat node asks it for nothing.
  const recorded = lane({ replays: 1, nodes: [uploading] });
  t.after(recorded.restore);
  assert.equal((await runLiveRepairLane(recorded.control, recorded.input))?.application.outcome, "applied");
});
