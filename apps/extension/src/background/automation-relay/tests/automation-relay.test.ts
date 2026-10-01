import assert from "node:assert/strict";
import test from "node:test";

import { AUTOMATION_PANEL_MESSAGES, type PanelRelayResponse } from "../../../shared/protocol";
import { AUTOMATION_RUN_LIST_LIMIT, handleAutomationRelay, type AutomationRelayDeps } from "../automation-relay";

type Call = { endpoint: string; payload: Record<string, unknown>; programId: string | undefined };

function harness(answers: Record<string, PanelRelayResponse> = {}, overrides: Partial<AutomationRelayDeps> = {}) {
  const calls: Call[] = [];
  const removed: string[] = [];
  const deps: AutomationRelayDeps = {
    isControlPage: () => true,
    call: async (endpoint, payload, programId) => {
      calls.push({ endpoint, payload, programId });
      return answers[endpoint] ?? { ok: true, payload: {} };
    },
    projectId: () => "project-1",
    lastStoppedRecordingId: () => "recording-9",
    removeRecordedStep: async (activityId) => {
      removed.push(activityId);
      return { ok: true, payload: { removedFrom: "queue", removedCount: 1 } };
    },
    ...overrides
  };
  const send = async (message: Record<string, unknown>) => {
    const result = await handleAutomationRelay(message as never, {} as chrome.runtime.MessageSender, deps);
    assert.equal(result.handled, true);
    return (result as { response: PanelRelayResponse }).response;
  };
  return { calls, removed, send, deps };
}

test("messages that are not Automation panel's are left for the next handler", async () => {
  const h = harness();
  assert.deepEqual(await handleAutomationRelay({ type: "fluxiq.getStatus" }, {} as chrome.runtime.MessageSender, h.deps), { handled: false });
});

test("only the side panel or the popup may ask, and nothing reaches Core otherwise", async () => {
  const h = harness({}, { isControlPage: () => false });
  const reply = await h.send({ type: AUTOMATION_PANEL_MESSAGES.runAutomation, flowId: "flow-1" });
  assert.deepEqual(reply, { ok: false, code: "forbidden", error: "Only the FluxIQ panel can do that." });
  assert.equal(h.calls.length, 0);
});

test("the automations list reads Flows, then their newest runs, and joins nothing itself", async () => {
  const h = harness({
    "list-flow-summaries": { ok: true, payload: { flows: [{ flowId: "flow-1" }] } },
    "list-flow-runs": { ok: true, payload: { runs: [{ runId: "run-1", flowId: "flow-1" }], page: {} } }
  });
  const reply = await h.send({ type: AUTOMATION_PANEL_MESSAGES.listAutomations });
  assert.deepEqual(reply, { ok: true, payload: { flows: [{ flowId: "flow-1" }], runs: [{ runId: "run-1", flowId: "flow-1" }] } });
  assert.deepEqual(h.calls.map((call) => [call.endpoint, call.payload]), [
    ["list-flow-summaries", { projectId: "project-1" }],
    ["list-flow-runs", { projectId: "project-1", sort: "updated", direction: "desc", limit: AUTOMATION_RUN_LIST_LIMIT }]
  ]);
});

test("a run sends only the project and the Flow, whatever else the panel put in the message", async () => {
  const h = harness();
  await h.send({ type: AUTOMATION_PANEL_MESSAGES.runAutomation, flowId: "flow-1", flow: { nodes: [] }, runIntent: "build_and_adapt", permittedConsequences: ["move_money"], inputs: { password: "x" } });
  await h.send({ type: AUTOMATION_PANEL_MESSAGES.testGeneratedAutomation, flowId: "flow-2", proposalId: "p" });
  assert.deepEqual(h.calls.map((call) => [call.endpoint, call.payload]), [
    ["run-runtime-session", { projectId: "project-1", flowId: "flow-1" }],
    ["run-runtime-session", { projectId: "project-1", flowId: "flow-2" }]
  ]);
  assert.deepEqual(await h.send({ type: AUTOMATION_PANEL_MESSAGES.runAutomation }), { ok: false, code: "invalid_request", error: "That request is missing its flowId." });
});

test("a run's detail reads compact, then the adaptations of the run's Flow", async () => {
  const h = harness({
    "get-flow-run-detail": { ok: true, payload: { runDetail: { runId: "run-1", summary: { flowId: "flow-7" } } } },
    "list-flow-adaptations": { ok: true, payload: { adaptations: [{ adaptationId: "a1" }] } }
  });
  const reply = await h.send({ type: AUTOMATION_PANEL_MESSAGES.runDetail, runId: "run-1" });
  assert.deepEqual(reply, { ok: true, payload: { runDetail: { runId: "run-1", summary: { flowId: "flow-7" } }, adaptations: [{ adaptationId: "a1" }] } });
  assert.deepEqual(h.calls.map((call) => [call.endpoint, call.payload]), [
    ["get-flow-run-detail", { projectId: "project-1", runId: "run-1", compact: true }],
    ["list-flow-adaptations", { projectId: "project-1", flowId: "flow-7" }]
  ]);
});

test("an export names its run, dataset and format", async () => {
  const h = harness();
  await h.send({ type: AUTOMATION_PANEL_MESSAGES.exportDataset, runId: "run-1", datasetId: "d1", format: "csv" });
  assert.deepEqual(h.calls[0]?.payload, { projectId: "project-1", runId: "run-1", datasetId: "d1", format: "csv" });
  assert.equal((await h.send({ type: AUTOMATION_PANEL_MESSAGES.exportDataset, runId: "run-1", datasetId: "d1" })).ok, false);
});

test("model readiness asks the secret-keys program and keeps only kind, provider and enabled", async () => {
  const h = harness({
    snapshot: { ok: true, payload: { keys: [{ id: "secret:1", name: "My OpenAI key", kind: "llm-api-key", provider: "openai", enabled: true, metadata: { hint: "sk-...1234" } }, { kind: "llm-api-key", enabled: "yes" }] } }
  });
  const reply = await h.send({ type: AUTOMATION_PANEL_MESSAGES.modelReadiness });
  assert.deepEqual(reply, { ok: true, payload: { keys: [{ kind: "llm-api-key", provider: "openai", enabled: true }, { kind: "llm-api-key", enabled: false }] } });
  assert.deepEqual(h.calls, [{ endpoint: "snapshot", payload: {}, programId: "secret-keys" }]);
});

test("a proposal is generated directly from the last stopped recording, and saved by approving it", async () => {
  const h = harness();
  await h.send({ type: AUTOMATION_PANEL_MESSAGES.generateFromRecording, mode: "llm_assisted" });
  await h.send({ type: AUTOMATION_PANEL_MESSAGES.saveGeneratedAutomation, proposalId: "proposal-1", decision: "rejected", policyOverride: {} });
  assert.deepEqual(h.calls.map((call) => [call.endpoint, call.payload]), [
    ["generate-recording-proposal", { projectId: "project-1", recordingId: "recording-9", mode: "direct" }],
    ["review-recording-flow-proposal", { projectId: "project-1", proposalId: "proposal-1", decision: "approved" }]
  ]);
  const none = harness({}, { lastStoppedRecordingId: () => undefined });
  assert.equal((await none.send({ type: AUTOMATION_PANEL_MESSAGES.generateFromRecording })).ok, false);
  assert.equal(none.calls.length, 0);
});

test("a step is removed by the activity id the log showed, and without a project nothing else runs", async () => {
  const h = harness({}, { projectId: () => undefined });
  assert.deepEqual(await h.send({ type: AUTOMATION_PANEL_MESSAGES.removeRecordingStep, entryId: "dom.click.1.x" }), { ok: true, payload: { removedFrom: "queue", removedCount: 1 } });
  assert.deepEqual(h.removed, ["dom.click.1.x"]);
  assert.equal((await h.send({ type: AUTOMATION_PANEL_MESSAGES.listAutomations })).ok, false);
  assert.equal(h.calls.length, 0);
});

test("a Core failure is passed through unchanged", async () => {
  const refused: PanelRelayResponse = { ok: false, code: "refused", httpStatus: 403, error: "Not on the allowlist." };
  const h = harness({ "list-flow-summaries": refused });
  assert.deepEqual(await h.send({ type: AUTOMATION_PANEL_MESSAGES.listAutomations }), refused);
});
