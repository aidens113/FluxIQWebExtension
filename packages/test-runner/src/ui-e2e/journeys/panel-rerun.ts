// Finding a saved Flow again through the panel and rerunning it, deterministic
// and judged, as a person reusing their work would.
//
// The Flow is found by the hierarchy search, and the row found must carry the
// Flow's own stable identity. The run is started from Runtime Debug under No
// LLM intervention and must succeed at every action with no model activity.
// Its answer is then judged the way the journey that saved it was judged: an
// extraction's stored rows must equal the saved digest and still match the
// record oracle; a form's page must reach the scenario's final-state oracle.
import { RunnerFailure } from "../../failure.js";
import { openFlowInCurrentProject, openProjectInPanel, runDemoFlowFromPanel, selectFlowInCurrentProject, stableHierarchyNodeId, waitForRoutedRunDetail } from "../../demo-workspace/index.js";
import { assertExpectedFacts, playwrightScenarioFactProbe } from "../../scenario-assertions.js";
import { loadScenarioManifest } from "../../scenarios.js";
import { assertDatasetJudgement, judgeStoredDataset, readSingleRunDataset } from "./dataset-judgement.js";
import { assertProviderFreeRun } from "./provider-free-run.js";
import { changedIdentityFields, readSavedFlowIdentity, type SavedFlowIdentity, type SavedJourneyFlow } from "./saved-flow.js";
import type { JourneySession } from "./session.js";

export type SavedFlowRerun = Readonly<{
  label: SavedJourneyFlow["label"];
  foundInHierarchy: true;
  identitiesUnchanged: true;
  runId: string;
  actionAttempts: number;
  providerCalls: number;
  oracle: "passed";
  /** For an extraction: the rerun's stored rows against the saved answer. */
  dataset: Readonly<{ records: number; sha256Equal: true; expectedRecords: number; matchedRecords: number }> | null;
}>;

const ORACLE_TIMEOUT_MS = 10_000;

/** Reruns `flow` from the panel in a connected session and judges it; `before` is its identity as read before the restart. */
export async function rerunSavedFlow(session: JourneySession, flow: SavedJourneyFlow, before: SavedFlowIdentity): Promise<SavedFlowRerun> {
  const { control, panelPage, scenarioPage, scenarioUrl, evidence, config } = session;
  const { state } = flow;
  const unchanged = (after: SavedFlowIdentity, reasonCode: string) => {
    const changed = changedIdentityFields(before, after);
    if (changed.length) throw new RunnerFailure("runtime.behavior", "A saved Flow's identity changed across the restart", { details: { reasonCode, flow: flow.label, changedFields: changed } });
  };
  unchanged(await readSavedFlowIdentity(control, flow), "restart.identity_changed");
  const target = new URL(flow.scenarioPath, new URL(scenarioUrl).origin).href;
  if (scenarioPage.url() !== target) await evidence.step("scenario", `rerun-open-${flow.label}`, "Open the page the saved Flow runs on", () => scenarioPage.goto(target).then(() => undefined));
  await control.selectExistingContext(state.projectId, undefined, {}, state.flowId);

  await openProjectInPanel(panelPage, config.origin, state.projectName, evidence);
  const treeItemId = await selectFlowInCurrentProject(panelPage, state.flowName, evidence);
  if (treeItemId !== `flow-${stableHierarchyNodeId(state.flowId)}`) {
    throw new RunnerFailure("runtime.behavior", "The hierarchy search found a different Flow under the saved name", { details: { reasonCode: "restart.hierarchy_identity", flow: flow.label } });
  }
  await openFlowInCurrentProject(panelPage, state.flowName, evidence);
  const graph = await control.getExactFlow(state.projectId, state.graphFlowId);
  const actionCount = Array.isArray(graph.document.nodes) ? graph.document.nodes.length : 0;
  const execution = await runDemoFlowFromPanel(panelPage, state, evidence);
  if (execution.status !== "succeeded") {
    throw new RunnerFailure("runtime.behavior", "A saved Flow did not succeed when rerun after the restart", { details: { reasonCode: "restart.rerun_failed", flow: flow.label, status: execution.status } });
  }
  const detail = await waitForRoutedRunDetail(control, state, execution.runId, actionCount);
  if (detail.actionAttempts.length !== actionCount || detail.actionAttempts.some(attempt => attempt.status !== "succeeded")) {
    throw new RunnerFailure("runtime.behavior", "A rerun did not succeed at every saved action", { details: { reasonCode: "restart.rerun_attempts", flow: flow.label, actionAttempts: detail.actionAttempts.length, savedActions: actionCount } });
  }
  const activity = assertProviderFreeRun(detail);
  const manifest = await loadScenarioManifest(config.repositoryRoot, flow.scenarioId);
  let dataset: SavedFlowRerun["dataset"] = null;
  if (flow.judge.kind === "dataset") {
    const entry = manifest.expected.extracted?.[0];
    if (!entry) throw new RunnerFailure("fixture.invalid", "The saved extraction's scenario lists no expected records", { details: { reasonCode: "extraction.oracle_missing" } });
    const judged = judgeStoredDataset(await readSingleRunDataset(control, { projectId: state.projectId, runId: execution.runId }), entry, { scenarioOrigin: new URL(scenarioUrl).origin });
    assertDatasetJudgement(judged);
    if (judged.sha256 !== flow.judge.sha256 || judged.observedRecords !== flow.judge.records) {
      throw new RunnerFailure("runtime.behavior", "The rerun stored a different answer than the saved run", { details: { reasonCode: "restart.dataset_changed", flow: flow.label, savedRecords: flow.judge.records, rerunRecords: judged.observedRecords } });
    }
    dataset = { records: judged.observedRecords, sha256Equal: true, expectedRecords: judged.expectedRecords, matchedRecords: judged.matchedRecords };
  } else if (!await finalStateHolds(manifest.expected.finalState ?? [], scenarioPage)) {
    throw new RunnerFailure("runtime.behavior", "The rerun did not reach the scenario's final-state oracle", { details: { reasonCode: "restart.oracle_not_reached", flow: flow.label } });
  }
  unchanged(await readSavedFlowIdentity(control, flow), "restart.flow_changed_by_rerun");
  return { label: flow.label, foundInHierarchy: true, identitiesUnchanged: true, runId: execution.runId, actionAttempts: detail.actionAttempts.length, providerCalls: activity.providerCalls, oracle: "passed", dataset };
}

async function finalStateHolds(facts: Parameters<typeof assertExpectedFacts>[0], page: JourneySession["scenarioPage"]): Promise<boolean> {
  if (facts.length === 0) return false;
  const probe = playwrightScenarioFactProbe(page);
  const deadline = Date.now() + ORACLE_TIMEOUT_MS;
  for (;;) {
    if (await assertExpectedFacts(facts, probe).then(() => true, () => false)) return true;
    if (Date.now() >= deadline) return false;
    await page.waitForTimeout(200);
  }
}
