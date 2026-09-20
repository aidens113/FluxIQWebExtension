import { RunnerFailure } from "../failure.js";

export const panelGoldenPathStages = [
  "instruction_entry",
  "exploration_progress",
  "creation_proposal_review",
  "creation_approval",
  "creation_application",
  "normal_run",
  "normal_run_presentation",
  "failure_presentation",
  "repair_review_apply",
  "repaired_rerun",
  "restart_saved_reuse",
  "recording_path",
] as const;

export type PanelGoldenPathStage = typeof panelGoldenPathStages[number];
export type PanelGoldenPathStageStatus = "verified" | "unverified";
export type PanelGoldenPathStageResult = Readonly<{
  stage: PanelGoldenPathStage;
  status: PanelGoldenPathStageStatus;
  evidence: string;
}>;

export type PanelGoldenPathIdentity = Readonly<{
  projectId: string;
  flowId: string;
  creationAdaptationId: string;
}>;

export function assertPanelGoldenIdentity(
  expected: PanelGoldenPathIdentity,
  actual: Readonly<{ projectId: string; flowId: string; adaptationId?: string }>,
  checkpoint: string,
): void {
  if (actual.projectId !== expected.projectId || actual.flowId !== expected.flowId
    || (actual.adaptationId !== undefined && actual.adaptationId !== expected.creationAdaptationId)) {
    throw new RunnerFailure("runtime.behavior", `Panel golden path changed Flow identity at ${checkpoint}`, {
      details: { reasonCode: "panel_golden_path.identity_mismatch", checkpoint },
    });
  }
}

export function assertPanelGoldenStages(results: readonly PanelGoldenPathStageResult[]): void {
  const seen = new Set(results.map(result => result.stage));
  const missing = panelGoldenPathStages.filter(stage => !seen.has(stage));
  if (missing.length) {
    throw new RunnerFailure("runtime.behavior", "Panel golden path did not account for every required visible stage", {
      details: { reasonCode: "panel_golden_path.stage_missing", missingStageCount: missing.length },
    });
  }
}

export function unverifiedPanelGoldenStages(results: readonly PanelGoldenPathStageResult[]): PanelGoldenPathStage[] {
  return results.filter(result => result.status === "unverified").map(result => result.stage);
}

