import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildCreatedFlowFromChat, loadCreatedFlowRequest } from "../../flow-lane/index.js";
import { runExtensionChatCheck } from "../../extension-chat-check/index.js";
import { loadPersonChecks } from "../../person-simulation/index.js";
import { resolveLabPaths } from "../../lab-instance/index.js";
import { loadScenarioManifest } from "../../scenarios.js";
import type { PreflightEvidence } from "./evidence.js";
import { classifyPreflight } from "./evidence.js";
import { proveOfflinePreflightRead } from "./prove-read.js";
import { proveOfflinePreflightPermission } from "./permission-probe.js";

/** Runs real isolated protocol stages; a generic confirmation never claims a site's own challenge passed. */
export async function runOfflinePreflight(input: { repositoryRoot: string; fluxiqRepositoryRoot: string; scenarioId: string; taskId: string; source: PreflightEvidence["source"]; evidenceDirectory: string }) {
  const paths = resolveLabPaths(input.repositoryRoot, process.env);
  const scenario = await loadScenarioManifest(input.repositoryRoot, input.scenarioId, paths.scenarioLabDist);
  const request = await loadCreatedFlowRequest({ repositoryRoot: input.repositoryRoot, scenarioLabDist: paths.scenarioLabDist, scenarioId: input.scenarioId, taskId: input.taskId });
  const taskDigest = createHash("sha256").update(JSON.stringify(request.task)).digest("hex");
  const checks = await loadPersonChecks(paths.scenarioLabDist, input.scenarioId);
  const stages: Array<PreflightEvidence["stages"][number]> = [];
  const requiredPermission = Boolean(request.task.permissionPoint || request.task.permits?.length);
  const result = await runExtensionChatCheck({
    repositoryRoot: input.repositoryRoot, fluxiqRepositoryRoot: input.fluxiqRepositoryRoot,
    scenarioId: input.scenarioId, browser: "chrome", pagePath: scenario.startPath, ask: false, evidenceDirectory: input.evidenceDirectory,
    proof: async ({ context, control, authorizationPin }) => {
      const probe = await proveOfflinePreflightRead({ context, control, authorizationPin });
      const probeFile = await context.evidence.json("generic-read-probe", probe);
      stages.push({ stage: "person_answer", passed: probe.personAnswered, artifact: probeFile }, { stage: "read", passed: probe.readSucceeded, artifact: probeFile });
      const panel = context.session.panel!;
      const built = await buildCreatedFlowFromChat(control, { panelInput: panel.input, type: (text) => panel.send(text), shows: () => panel.text(), picture: async () => undefined }, { projectId: context.projectId, domainId: "web-automation", instruction: request.task.instruction, authoringMode: "answer-first" });
      const taskFile = await context.evidence.json("task-start", { taskId: request.task.id, taskDigest, flowCreated: built.flowId !== null, became: built.build.chat?.became ?? null, applied: built.applied !== null });
      stages.push({ stage: "chat_start", passed: built.flowId !== null && built.build.chat?.became === "build", artifact: taskFile });
    },
  });
  stages.push({ stage: "pairing", passed: result.extensionProject === "matches" && result.relay !== null && Object.values(result.relay.checks).every(Boolean), artifact: path.join(input.evidenceDirectory, "result-chrome.json") });
  let permissionExercised = false;
  if (requiredPermission && request.task.permissionPoint) {
    const file = path.join(input.evidenceDirectory, "permission-probe.json");
    try {
      const permission = await proveOfflinePreflightPermission({ ...input, instruction: request.task.instruction, consequence: request.task.permissionPoint.consequence, startPath: scenario.startPath, seed: scenario.seed });
      permissionExercised = permission.actualStartGate && permission.deniedInPanel && permission.noLastingAct && permission.decisionCalls === 0;
      await writeFile(file, JSON.stringify(permission, null, 2));
    } catch (error) {
      await mkdir(input.evidenceDirectory, { recursive: true });
      await writeFile(file, JSON.stringify({ proof: "permission_protocol_only", passed: false, code: error instanceof Error && /^preflight_[a-z_]+$/u.test(error.message) ? error.message : "permission_probe_failed" }, null, 2));
    }
    stages.push({ stage: "permission_answer", passed: permissionExercised, artifact: file });
  }
  const evidence: PreflightEvidence = {
    scenarioId: input.scenarioId, source: input.source, stages,
    permission: { applicability: requiredPermission ? "required" : "not_applicable", taskId: request.task.id, taskDigest, declaredConsequences: [...(request.task.permits ?? [])], pointDeclared: request.task.permissionPoint !== undefined },
    siteChallenge: checks === null ? "not_declared" : "not_run", externalCalls: 0, externalUsd: 0,
  };
  await mkdir(input.evidenceDirectory, { recursive: true });
  await writeFile(path.join(input.evidenceDirectory, "preflight.json"), JSON.stringify({ evidence, classification: classifyPreflight(evidence), taskId: input.taskId, taskDigest, runtimeFailure: result.failure === null ? null : result.stage, gaps: requiredPermission && !permissionExercised ? ["declared_task_permission_not_exercised"] : [] }, null, 2));
  return evidence;
}
