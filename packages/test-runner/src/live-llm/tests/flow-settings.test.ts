import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, DEFAULT_LLM_MODEL, LLM_LAB_SCHEMA_VERSION, type LlmExecutionProfile, type LlmTaskKind } from "@fluxiq-web-extension/test-contracts";
import { configureFlowLiveLlmExecution, type LiveLlmFlowSettingsControl } from "../flow-settings.js";
import { planAtLabCeiling } from "./lab-ceiling.js";

/**
 * The Flow's stored adaptation mode follows the plan's purpose. Core reads a
 * stored `manual_approval` as manual proposals even with no per-run override,
 * so a created Flow's `explore_and_adapt` playback that stored it could never
 * promote, resume or judge its own repair.
 */

function profile(task: LlmTaskKind): LlmExecutionProfile {
  return {
    schemaVersion: LLM_LAB_SCHEMA_VERSION,
    profileId: "lab-settings",
    mode: "live",
    provider: "deepseek",
    model: DEFAULT_LLM_MODEL,
    task,
    scenarioNetworkPolicy: "loopback-only",
    providerEgressPolicy: "core-trusted-provider-only",
    externalSideEffects: false,
    approvalMode: "manual",
    retainRawPrompts: false,
    retainRawResponses: false,
    maxConcurrentRuns: 1,
    budget: { ...DEFAULT_LLM_LAB_BUDGET },
  };
}

/** A Core that stores the saved metadata and reads it back, optionally altered on the way out. */
function core(readBack: (metadata: Record<string, unknown>) => Record<string, unknown> = (metadata) => metadata) {
  const saved: Record<string, unknown>[] = [];
  const control: LiveLlmFlowSettingsControl = {
    async automationStudioCall(endpoint, payload) {
      if (endpoint === "update-flow-settings") {
        const flow = payload.flow as { metadata: Record<string, unknown> };
        saved.push(flow.metadata);
        return { flow: {} };
      }
      if (endpoint === "get-flow") return { flow: { flowId: payload.flowId, metadata: readBack(saved.at(-1) ?? {}) } };
      throw new Error(`unexpected endpoint ${endpoint}`);
    },
  };
  return { control, saved };
}

const target = { projectId: "project.web", flowId: "flow.one", secretKeyId: "secret.one" };

test("an explore_and_adapt plan saves the Flow fully_adaptive", async () => {
  const plan = planAtLabCeiling(profile("repair"));
  assert.equal(plan.purpose, "explore_and_adapt");
  const { control, saved } = core();
  await configureFlowLiveLlmExecution(control, { ...target, plan });
  assert.equal(saved.length, 1);
  assert.equal(saved[0]!.adaptationMode, "fully_adaptive");
  assert.equal(saved[0]!.adaptationModeVersion, 1);
});

test("every other plan purpose saves the Flow manual_approval", async () => {
  for (const [task, purpose] of [["adapt", "diagnose_and_adapt"], ["diagnose", "diagnosis_only"], ["create-flow", "build_and_adapt"]] as const) {
    const plan = planAtLabCeiling(profile(task));
    assert.equal(plan.purpose, purpose);
    const { control, saved } = core();
    await configureFlowLiveLlmExecution(control, { ...target, plan });
    assert.equal(saved[0]!.adaptationMode, "manual_approval", purpose);
  }
});

test("a read-back whose adaptation mode differs from the one written is refused", async () => {
  const plan = planAtLabCeiling(profile("repair"));
  const { control } = core((metadata) => ({ ...metadata, adaptationMode: "manual_approval" }));
  await assert.rejects(configureFlowLiveLlmExecution(control, { ...target, plan }), /Live LLM Flow settings refused: Core did not store the Flow's fully_adaptive adaptation mode/u);
  const missing = core(({ adaptationMode: _dropped, ...metadata }) => metadata);
  await assert.rejects(configureFlowLiveLlmExecution(missing.control, { ...target, plan: planAtLabCeiling(profile("adapt")) }), /did not store the Flow's manual_approval adaptation mode/u);
});
