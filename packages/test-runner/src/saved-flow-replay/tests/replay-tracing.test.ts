import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { inspectReplayTraces } from "../stored-traces.js";
import { replaySavedFlow } from "../replay-saved-flow.js";

type Seams = NonNullable<Parameters<typeof replaySavedFlow>[1]>;
type Options = Parameters<typeof replaySavedFlow>[0];

function harness(record: { topologyOptions: unknown[]; inspected: unknown[]; tokenReads: number }, tokenRead: "found" | "fails" = "found"): Seams {
  const task = { id: "unit-task", scenarioId: "everything-store", personCheck: { disposition: "complete" } };
  const control = {
    getExactFlow: async () => ({ contentHash: "unchanged" }),
    getRunDetail: async () => ({ providerCallCount: 0, interventions: [], providerCalls: [], providerCallsOmitted: 0, llmGate: { invoked: false } }),
  };
  const browser = { context: { pages: () => [{ isClosed: () => false, url: () => "http://127.0.0.1:4100/" }] }, openStart: async () => undefined, close: async () => undefined, guard: { assertNoViolations() {} } };
  return {
    resolveLabPaths: () => ({ scenarioLabDist: "unit-dist" }),
    loadScenarioManifest: async () => ({ id: task.scenarioId, seed: 1, startPath: "/", recordingScript: [], expected: {} }),
    loadCreatedFlowRequest: async () => ({ task, workflowId: "unit-workflow", judgement: { judgeBy: "playback-goal" } }),
    resolveScenarioWorkflow: () => ({ workflowId: "unit-workflow", recordingScript: [], expected: {} }),
    startTopology: async (options: unknown) => {
      record.topologyOptions.push(options);
      return { control, projectId: "unit-project", authorizationPassword: "unit-password", scenarioOrigin: "http://127.0.0.1:4100", allocation: { controllerToken: "unit-token", storageDir: "unit-storage", scenarioPortRetained: true }, close: async () => undefined };
    },
    selectReplayProject: async () => "actual-project",
    readFlowGraphHash: async () => "graph",
    readFlowNodes: async () => [{ id: "read", outputActionId: "web.dom.extract", definitionId: "web.output.dom-extract", parameterValues: {} }],
    replayKeyIdentities: async () => [],
    openReplayBrowser: async () => browser,
    resetScenarioLab: async () => undefined,
    armScenarioVariant: async () => undefined,
    startLabPerson: async () => ({ finish: async () => undefined, writeFailure: undefined }),
    runProviderFreeReplayFlow: async () => ({ runId: "unit-run", status: "succeeded", actions: [{ actionType: "web.dom.click", status: "succeeded", nodeId: "node-1", attemptIndex: 0, startedAt: "2026-10-20T00:00:00.000Z", durationMs: 12 }], extracted: [], harnessActivations: 0 }),
    removeRunOwnedTopologyState: async () => undefined,
    readExtensionSessionToken: async () => {
      record.tokenReads += 1;
      if (tokenRead === "fails") throw new Error("the extension worker went away");
      return "unit-session-token";
    },
    inspectReplayTraces: async (input: Parameters<typeof inspectReplayTraces>[0]) => {
      record.inspected.push(input);
      return { inspection: null, failure: null, secretSources: { replaySecrets: input.replaySecrets.length, sessionTokens: input.sessionTokens.length, sessionTokenReadFailures: input.sessionTokenReadFailures }, parity: null, parityFailure: null };
    },
  } as unknown as Seams;
}

for (const tracing of [undefined, false] as const) {
  test(`replay starts Core with tracing ${tracing === false ? "off" : "on"}, times its phases and reads the traces after Core stops`, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "saved-tracing-"));
    const record = { topologyOptions: [] as unknown[], inspected: [] as unknown[], tokenReads: 0 };
    const options = { repositoryRoot: directory, fluxiqRepositoryRoot: directory, runsDirectory: directory, scenarioId: "everything-store", flowId: "unit-flow", environment: {}, credentialSources: [], target: { mode: "persistent-isolated", workspace: "unit-workspace" }, ...(tracing === false ? { tracing } : {}) } as Options;
    try {
      const result = await replaySavedFlow(options, harness(record));
      assert.equal(result.verdict, "passed", JSON.stringify({ reasons: result.reasons, error: result.error }));
      assert.equal((record.topologyOptions[0] as { tracing?: boolean }).tracing, tracing !== false);
      assert.equal(result.tracing, tracing !== false);
      for (const phase of ["totalMs", "topologyMs", "browserMs", "runMs", "teardownMs", "traceInspectionMs"] as const) assert.equal(typeof result.timings[phase], "number", phase);
      assert.deepEqual(result.run?.actions, [{ actionType: "web.dom.click", status: "succeeded", nodeId: "node-1", attemptIndex: 0, durationMs: 12 }]);
      const inspected = record.inspected[0] as Parameters<typeof inspectReplayTraces>[0];
      assert.equal(inspected.storageDir, "unit-storage");
      assert.equal(inspected.projectId, "actual-project");
      assert.ok(Date.parse(inspected.startedAt) <= Date.now());
      assert.ok(inspected.replaySecrets.includes("unit-token") && inspected.replaySecrets.includes("unit-password"));
      // Read after pairing and again before the close; one token, searched once.
      assert.equal(record.tokenReads, 2);
      assert.deepEqual(inspected.sessionTokens, ["unit-session-token"]);
      assert.deepEqual(result.traces?.secretSources.sessionTokens, 1);
      const receipt = await readFile(result.resultPath, "utf8");
      assert.equal(receipt.includes("unit-session-token"), false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}

test("a trace store that cannot be read is a named failure, not a throw", async () => {
  const outcome = await inspectReplayTraces({ storageDir: "unit-storage", projectId: "p", startedAt: "2026-10-20T00:00:00.000Z", replaySecrets: ["s"], sessionTokens: [], sessionTokenReadFailures: 0 }, { inspect: async () => { throw new Error("store unavailable"); } });
  assert.deepEqual(outcome, { inspection: null, failure: "Error: store unavailable", secretSources: { replaySecrets: 1, sessionTokens: 0, sessionTokenReadFailures: 0 }, parity: null, parityFailure: "not run: the trace store could not be read" });
});

const EMPTY_INSPECTION = { projectId: "p", traces: [], tracesSkipped: 0, dedupe: { references: 0, referencedBytes: 0, distinct: 0, distinctBytes: 0 }, secretScan: { secretsChecked: 0, eventsScanned: 0, artifactsScanned: 0, eventHits: 0, artifactHits: 0 } };
const EMPTY_PARITY = { projectId: "p", traces: [], tracesSkipped: 0, totals: { traces: 0, matched: 0, diverged: 0, failed: 0, compared: 0, matchedPoints: 0, divergencesByClass: { capture_gap: 0, nondeterminism: 0, intake_defect: 0 } }, durationMs: 0 };

test("the parity check replays the same traces the read-back read, from the same store", async () => {
  let seen: { automationDataDir: string; projectId: string; include?: (manifest: { startedAt: string }) => boolean } | undefined;
  const outcome = await inspectReplayTraces({ storageDir: path.join("w", ".fluxiq"), projectId: "p", startedAt: "2026-10-20T00:00:00.000Z", replaySecrets: [], sessionTokens: [], sessionTokenReadFailures: 0 }, {
    inspect: async () => EMPTY_INSPECTION,
    parity: async input => {
      seen = input as unknown as typeof seen;
      return EMPTY_PARITY;
    },
  });
  assert.equal(seen?.automationDataDir, path.join("w", ".fluxiq", "artifacts", "automation-studio"));
  assert.equal(seen?.projectId, "p");
  assert.equal(seen?.include?.({ startedAt: "2026-10-19T23:59:59.999Z" }), false);
  assert.equal(seen?.include?.({ startedAt: "2026-10-20T00:00:00.001Z" }), true);
  assert.deepEqual(outcome.parity, EMPTY_PARITY);
  assert.equal(outcome.parityFailure, null);
});

test("a parity check that throws keeps the read-back and names only the error's kind", async () => {
  const outcome = await inspectReplayTraces({ storageDir: "unit-storage", projectId: "p", startedAt: "2026-10-20T00:00:00.000Z", replaySecrets: [], sessionTokens: [], sessionTokenReadFailures: 0 }, {
    inspect: async () => EMPTY_INSPECTION,
    parity: async () => {
      throw new TypeError("quoted page text");
    },
  });
  assert.deepEqual(outcome.inspection, EMPTY_INSPECTION);
  assert.equal(outcome.parity, null);
  assert.equal(outcome.parityFailure, "the parity check threw TypeError (text withheld)");
  assert.equal(JSON.stringify(outcome).includes("quoted page text"), false);
});

test("the replay reads only the traces it started, under the workspace's Automation Studio storage", async () => {
  let seen: { automationDataDir: string; include?: (manifest: { startedAt: string }) => boolean; secrets?: readonly string[] } | undefined;
  await inspectReplayTraces({ storageDir: path.join("w", ".fluxiq"), projectId: "p", startedAt: "2026-10-20T00:00:00.000Z", replaySecrets: ["a"], sessionTokens: ["b"], sessionTokenReadFailures: 0 }, {
    inspect: async input => {
      seen = input as unknown as typeof seen;
      return { projectId: "p", traces: [], tracesSkipped: 0, dedupe: { references: 0, referencedBytes: 0, distinct: 0, distinctBytes: 0 }, secretScan: { secretsChecked: 2, eventsScanned: 0, artifactsScanned: 0, eventHits: 0, artifactHits: 0 } };
    },
    parity: async () => EMPTY_PARITY,
  });
  assert.equal(seen?.automationDataDir, path.join("w", ".fluxiq", "artifacts", "automation-studio"));
  assert.equal(seen?.include?.({ startedAt: "2026-10-19T23:59:59.999Z" }), false);
  assert.equal(seen?.include?.({ startedAt: "2026-10-20T00:00:00.001Z" }), true);
  assert.deepEqual(seen?.secrets, ["a", "b"]);
});

test("a gateway token that cannot be read is counted in the receipt, and the replay still completes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "saved-tracing-"));
  const record = { topologyOptions: [] as unknown[], inspected: [] as unknown[], tokenReads: 0 };
  const options = { repositoryRoot: directory, fluxiqRepositoryRoot: directory, runsDirectory: directory, scenarioId: "everything-store", flowId: "unit-flow", environment: {}, credentialSources: [], target: { mode: "persistent-isolated", workspace: "unit-workspace" } } as Options;
  try {
    const result = await replaySavedFlow(options, harness(record, "fails"));
    assert.equal(result.verdict, "passed", JSON.stringify({ reasons: result.reasons, error: result.error }));
    assert.deepEqual(result.traces?.secretSources, { replaySecrets: 2, sessionTokens: 0, sessionTokenReadFailures: 2 });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
