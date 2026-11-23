import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { assertAttemptSeries, resolveScenarioWorkflow, type AttemptSeries } from "@fluxiq-web-extension/test-contracts";
import { loadCreatedFlowRequest } from "../../flow-lane/index.js";
import { loadScenarioManifest } from "../../scenarios.js";
import { resolveLabPaths } from "../../lab-instance/index.js";
import type { PreflightEvidence } from "../preflight/index.js";
import { OFFLINE_SCOREBOARD_TASKS } from "./fixed-tasks.js";
import { evaluateOfflineScoreboard, type OfflineScoreboardEvidence } from "./evaluate.js";
import { offlineSourceFingerprint } from "./source.js";

/** Reads actual emitted attempt bundles; old/missing accounting and provenance remain unknown. */
export async function collectOfflineScoreboard(input: { repositoryRoot: string; fluxiqRepositoryRoot: string; evidenceDirectory: string }) {
  const [core, extension] = await Promise.all([offlineSourceFingerprint(input.fluxiqRepositoryRoot), offlineSourceFingerprint(input.repositoryRoot)]);
  const source = { core, extension };
  const paths = resolveLabPaths(input.repositoryRoot, process.env);
  const oracleDigests: Record<string, string> = {};
  const taskDigests: Record<string, string> = {};
  const evidence: OfflineScoreboardEvidence[] = [];
  const gaps: Array<{ taskId: string; code: string }> = [];
  const read = async (file: string) => JSON.parse(await readFile(file, "utf8"));
  for (const task of OFFLINE_SCOREBOARD_TASKS) {
    try {
      const request = await loadCreatedFlowRequest({ repositoryRoot: input.repositoryRoot, scenarioLabDist: paths.scenarioLabDist, scenarioId: task.scenarioId, taskId: task.taskId });
      const scenario = await loadScenarioManifest(input.repositoryRoot, task.scenarioId, paths.scenarioLabDist);
      const workflow = resolveScenarioWorkflow(scenario, { ...(request.workflowId ? { workflowId: request.workflowId } : {}), ...(request.variantId ? { variantId: request.variantId } : {}) });
      oracleDigests[task.taskId] = createHash("sha256").update(JSON.stringify({ request, expected: workflow.expected })).digest("hex");
      taskDigests[task.taskId] = createHash("sha256").update(JSON.stringify(request.task)).digest("hex");
    } catch { gaps.push({ taskId: task.taskId, code: "current_task_oracle_unavailable" }); }
    try {
      const directory = path.join(input.evidenceDirectory, task.taskId);
      const bundlePath = path.join(directory, "attempt.json");
      const bundle = await read(bundlePath);
      const recordedSource = await read(path.join(directory, "source.json"));
      const oracle = await read(path.join(directory, "oracle.json"));
      const preflight = (await read(path.join(directory, "preflight.json"))).evidence as PreflightEvidence;
      if (!bundle.series || !Array.isArray(bundle.attempts)) throw new Error("missing_series");
      assertAttemptSeries(bundle.series);
      for (const stage of preflight.stages) await access(stage.artifact);
      const providerFree = bundle.provider === "scripted" || bundle.provider === "recorded";
      const attempts = bundle.attempts.map((entry: Record<string, any>) => {
        const calls = entry.modelCalls;
        const counts = calls && typeof calls === "object" ? Object.values(calls) : null;
        const logicalCalls = counts && counts.every((count) => typeof count === "number" && Number.isSafeInteger(count) && count >= 0) ? (counts as number[]).reduce((sum, count) => sum + count, 0) : null;
        return { ordinal: entry.row?.attempt, artifact: bundlePath, savedFlow: entry.saved?.flowId ?? null, savedDigest: entry.saved?.stepsDigest ?? null, startedFlow: entry.attempt?.flowId ?? null, startedDigest: entry.startedFrom?.draftDigest ?? null, logicalCalls, externalCalls: providerFree ? 0 : null, externalUsd: providerFree ? 0 : null, historicalUsd: null, modeledUsd: providerFree && typeof entry.row?.usd === "number" ? entry.row.usd : null };
      });
      evidence.push({ series: bundle.series as AttemptSeries, source: recordedSource, proof: bundle.reseededBetween === false && providerFree ? "full_attempt_series" : "isolated_saved_replay", oracleDigest: oracle.digest, preflight, attempts, configuredModel: typeof bundle.configuredModel === "string" ? bundle.configuredModel : typeof bundle.model === "string" ? bundle.model : null });
    } catch { gaps.push({ taskId: task.taskId, code: "attempt_preflight_or_provenance_unavailable" }); }
  }
  return { source, rows: evaluateOfflineScoreboard({ source, oracleDigests, taskDigests, evidence }), gaps, externalUsd: 0 as const };
}
