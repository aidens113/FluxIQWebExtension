import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { replaySavedFlow } from "../replay-saved-flow.js";

type Seams = NonNullable<Parameters<typeof replaySavedFlow>[1]>;
type Options = Parameters<typeof replaySavedFlow>[0];

for (const failure of [false, true]) {
  test(`declared replay person surrounds execution and teardown (${failure ? "failed" : "successful"} run)`, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "saved-person-"));
    const events: string[] = [];
    let personInput: Parameters<NonNullable<Seams["startLabPerson"]>>[0] | undefined;
    const task = { id: "unit-task", scenarioId: "crossborder-marketplace", personCheck: { disposition: "complete" } };
    const context = { pages: () => [{ isClosed: () => false, url: () => "http://127.0.0.1:4100/" }] };
    const browser = { context, openStart: async () => { events.push("open"); }, close: async () => { events.push("browser.close"); }, guard: { assertNoViolations() {} } };
    const control = {
      getExactFlow: async () => ({ contentHash: "unchanged" }),
      getRunDetail: async () => ({ providerCallCount: 0, interventions: [], providerCalls: [], providerCallsOmitted: 0, llmGate: { invoked: false } }),
    };
    const seams = {
      resolveLabPaths: () => ({ scenarioLabDist: "unit-dist" }),
      loadScenarioManifest: async () => ({ id: task.scenarioId, seed: 1, startPath: "/", recordingScript: [], expected: {} }),
      loadCreatedFlowRequest: async () => ({ task, workflowId: "unit-workflow", variantId: "unit-variant", judgement: { judgeBy: "playback-goal" } }),
      resolveScenarioWorkflow: () => ({ workflowId: "unit-workflow", variant: { id: "unit-variant" }, recordingScript: [], expected: {} }),
      startTopology: async () => ({ control, projectId: "unit-project", authorizationPassword: "unit-password", scenarioOrigin: "http://127.0.0.1:4100", allocation: { controllerToken: "unit-token", scenarioPortRetained: true }, close: async () => { events.push("core.close"); } }),
      selectReplayProject: async () => "actual-project",
      readFlowGraphHash: async () => "graph",
      readFlowNodes: async () => [{ id: "read", outputActionId: "web.dom.extract", definitionId: "web.output.dom-extract", parameterValues: {} }],
      replayKeyIdentities: async () => [],
      openReplayBrowser: async () => browser,
      resetScenarioLab: async () => undefined,
      armScenarioVariant: async () => undefined,
      startLabPerson: async (input: NonNullable<typeof personInput>) => {
        personInput = input;
        events.push("person.start");
        return { finish: async () => {
          events.push("person.finish");
          await input.write({ scenarioId: task.scenarioId, expected: null, playable: true, handOffs: [], permissionAnswers: [], pollFailures: 0, lastPollFailure: null });
        }, writeFailure: undefined };
      },
      runProviderFreeReplayFlow: async () => {
        events.push("run");
        if (failure) throw new Error("unit execution failed");
        return { runId: "unit-run", status: "succeeded", actions: [], extracted: [], harnessActivations: 0 };
      },
      removeRunOwnedTopologyState: async () => undefined,
    } as unknown as Seams;
    const options = { repositoryRoot: directory, fluxiqRepositoryRoot: directory, runsDirectory: directory, scenarioId: task.scenarioId, flowId: "unit-flow", environment: {}, credentialSources: [], target: { mode: "persistent-isolated", workspace: "unit-workspace" } } as Options;
    try {
      const result = await replaySavedFlow(options, seams);
      assert.ok(events.indexOf("person.start") >= 0, JSON.stringify({ events, error: result.error }));
      assert.ok(events.indexOf("person.start") < events.indexOf("run"));
      assert.ok(events.indexOf("person.finish") > events.indexOf("run"));
      assert.ok(events.indexOf("person.finish") < events.indexOf("browser.close"));
      assert.ok(events.indexOf("browser.close") < events.indexOf("core.close"));
      assert.equal(personInput?.projectId, "actual-project");
      assert.equal(personInput?.context, context);
      assert.equal(personInput?.task, task.personCheck);
      assert.equal(personInput?.workflowId, "unit-workflow");
      assert.equal(personInput?.variantId, "unit-variant");
      assert.equal(personInput?.permissions, undefined);
      const snapshot = JSON.parse(await readFile(path.join(directory, "replays", result.replayId, "person-hand-offs.json"), "utf8"));
      assert.equal(snapshot.playable, true);
      assert.equal(result.run?.status ?? null, failure ? null : "succeeded");
      assert.equal(result.verdict, failure ? "failed" : "passed", JSON.stringify({ reasons: result.reasons, error: result.error }));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}

for (const changed of [false, true]) {
  test(`the executable graph ${changed ? "changing" : "holding"} under an unchanged parent document ${changed ? "fails" : "passes"} the replay`, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "saved-person-"));
    const events: string[] = [];
    let graphReads = 0;
    let personInput: Parameters<NonNullable<Seams["startLabPerson"]>>[0] | undefined;
    const task = { id: "unit-task", scenarioId: "crossborder-marketplace", personCheck: { disposition: "complete" } };
    const context = { pages: () => [{ isClosed: () => false, url: () => "http://127.0.0.1:4100/" }] };
    const browser = { context, openStart: async () => { events.push("open"); }, close: async () => { events.push("browser.close"); }, guard: { assertNoViolations() {} } };
    const control = {
      getExactFlow: async () => ({ contentHash: "unchanged" }),
      getRunDetail: async () => ({ providerCallCount: 0, interventions: [], providerCalls: [], providerCallsOmitted: 0, llmGate: { invoked: false } }),
    };
    const seams = {
      resolveLabPaths: () => ({ scenarioLabDist: "unit-dist" }),
      loadScenarioManifest: async () => ({ id: task.scenarioId, seed: 1, startPath: "/", recordingScript: [], expected: {} }),
      loadCreatedFlowRequest: async () => ({ task, workflowId: "unit-workflow", variantId: "unit-variant", judgement: { judgeBy: "playback-goal" } }),
      resolveScenarioWorkflow: () => ({ workflowId: "unit-workflow", variant: { id: "unit-variant" }, recordingScript: [], expected: {} }),
      startTopology: async () => ({ control, projectId: "unit-project", authorizationPassword: "unit-password", scenarioOrigin: "http://127.0.0.1:4100", allocation: { controllerToken: "unit-token", scenarioPortRetained: true }, close: async () => { events.push("core.close"); } }),
      selectReplayProject: async () => "actual-project",
      readFlowNodes: async () => [{ id: "read", outputActionId: "web.dom.extract", definitionId: "web.output.dom-extract", parameterValues: {} }],
      replayKeyIdentities: async () => [],
      openReplayBrowser: async () => browser,
      resetScenarioLab: async () => undefined,
      armScenarioVariant: async () => undefined,
      startLabPerson: async (input: NonNullable<typeof personInput>) => {
        personInput = input;
        events.push("person.start");
        return { finish: async () => {
          events.push("person.finish");
          await input.write({ scenarioId: task.scenarioId, expected: null, playable: true, handOffs: [], permissionAnswers: [], pollFailures: 0, lastPollFailure: null });
        }, writeFailure: undefined };
      },
      runProviderFreeReplayFlow: async () => {
        events.push("run");
        
        return { runId: "unit-run", status: "succeeded", actions: [], extracted: [], harnessActivations: 0 };
      },
      removeRunOwnedTopologyState: async () => undefined,
      readFlowGraphHash: async () => (++graphReads === 1 || !changed ? "graph-a" : "graph-b"),
    } as unknown as Seams;
    const options = { repositoryRoot: directory, fluxiqRepositoryRoot: directory, runsDirectory: directory, scenarioId: task.scenarioId, flowId: "unit-flow", environment: {}, credentialSources: [], target: { mode: "persistent-isolated", workspace: "unit-workspace" } } as Options;
    try {
      const result = await replaySavedFlow(options, seams);
      assert.deepEqual(result.flowContentHash, { before: "unchanged", after: "unchanged" });
      assert.deepEqual(result.flowGraphHash, { before: "graph-a", after: changed ? "graph-b" : "graph-a" });
      assert.equal(result.verdict, changed ? "failed" : "passed", JSON.stringify({ reasons: result.reasons, error: result.error }));
      assert.equal(result.reasons.some(reason => reason.includes("executable graph")), changed);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
