import assert from "node:assert/strict";
import test from "node:test";
import type { RunHarnessRecovery } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../../failure.js";
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

function lane(options: { recovery?: RunHarnessRecovery; replays?: number; applyRefused?: boolean; providerCalls?: number; goal?: boolean } = {}) {
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
      if (endpoint === "get-flow") return { flow: { nodes: [] } };
      if (endpoint === "list-flow-subflows") return { subflows: [] };
      if (endpoint === "get-flow-adaptation") return { adaptation: { adaptationId: "adaptation-1", status: applied ? "applied" : "proposed" } };
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
    live: { repairsFlow: true, describe: () => ({ task: "repair", purpose: "explore_and_adapt" }) },
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
