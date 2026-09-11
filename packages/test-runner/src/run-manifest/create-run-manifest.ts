import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { ClonePackage, RunActionTiming, RunAutomationFailure, RunManifest, RunStepTiming, WebScenario } from "@fluxiq-web-extension/test-contracts";
import { sha256 } from "@fluxiq-web-extension/test-evidence";
import type { RunningTopology } from "../coordinator.js";
import type { ExistingFlowExecution, ExistingFluxIQPreflight } from "../existing-flow-run.js";
import type { IsolatedCloneImportResult } from "../isolated-flow-importer.js";
import type { FluxIQPanelVerificationOutcome } from "../panel-verification.js";
import type { FluxIQTargetConfiguration } from "../target-config.js";

const execFileAsync = promisify(execFile);

export type CloneRunState = {
  clonePackage?: ClonePackage;
  clonePackageHash?: string;
  destination?: IsolatedCloneImportResult;
  execution?: ExistingFlowExecution;
  sourceSessionIdentityVerified: boolean;
  sourceHashVerifiedAfterRun: boolean;
  cleanupOutcome: "pending" | "completed" | "failed";
};

export type RunManifestInput = {
  repositoryRoot: string;
  fluxiqRepositoryRoot: string;
  target: FluxIQTargetConfiguration | undefined;
  scenario: WebScenario;
  runId: string;
  seed: number;
  startedAt: string;
  verdict: "passed" | "failed";
  browserVersion: string;
  extensionPath: string;
  topology: RunningTopology | undefined;
  existingPreflight: ExistingFluxIQPreflight | undefined;
  existingExecution: ExistingFlowExecution | undefined;
  panelVerification: FluxIQPanelVerificationOutcome | undefined;
  cloneState: CloneRunState;
  workflowId: string | undefined;
  variantId: string | undefined;
  /** `undefined` when the lane could not observe what FluxIQ reported. */
  automationFailure: RunAutomationFailure | null | undefined;
  steps: RunStepTiming[];
  actions: RunActionTiming[];
};

/** Builds the run's `run.json`: provenance, environment, execution metadata, and run detail. */
export async function createRunManifest(input: RunManifestInput): Promise<RunManifest> {
  const { topology, target } = input;
  const extensionManifest = JSON.parse(await readFile(path.join(input.extensionPath, "manifest.json"), "utf8")) as { version: string };
  const fluxiqExecution = target?.mode === "clone"
    ? cloneExecutionMetadata(input.cloneState, input.panelVerification)
    : topology?.targetMode === "existing" && target?.mode === "existing" && input.existingPreflight && input.existingExecution
      ? { targetMode: "existing" as const, origin: topology.fluxiqOrigin, projectId: target.projectId, flowId: target.flowId, flowContentHash: input.existingPreflight.flow.contentHash, runtimeRunId: input.existingExecution.runId, ...(input.existingPreflight.gateway.runtimeId ? { runtimeId: input.existingPreflight.gateway.runtimeId } : {}), sessionIdentityVerified: input.existingPreflight.sessionIdentityVerified, panelVerification: input.panelVerification?.status ?? "limited" }
      : topology?.targetMode === "persistent-isolated" && target?.mode === "persistent-isolated"
        ? { targetMode: "persistent-isolated" as const, workspace: target.workspace }
        : topology?.targetMode === "isolated" ? { targetMode: "isolated" as const } : undefined;
  const ownsCorePorts = topology?.targetMode === "isolated" || topology?.targetMode === "persistent-isolated";
  return {
    schemaVersion: "0.1",
    runId: input.runId,
    scenarioId: input.scenario.id,
    scenarioRevision: sha256(JSON.stringify(input.scenario)),
    seed: input.seed,
    status: input.verdict,
    startedAt: input.startedAt,
    finishedAt: new Date().toISOString(),
    repositories: { facility: await revision(input.repositoryRoot), core: await revision(input.fluxiqRepositoryRoot) },
    compatibility: [],
    lockfiles: await lockfiles(input.repositoryRoot, input.fluxiqRepositoryRoot),
    extension: { version: extensionManifest.version, sha256: await hashDirectory(input.extensionPath), path: "apps/extension/dist/e2e-chromium" },
    environment: { os: os.platform(), architecture: os.arch(), browserName: "chromium", browserVersion: input.browserVersion, locale: "en-US", timezone: "UTC", viewport: { width: 1280, height: 720 } },
    ports: topology ? { scenario: topology.allocation.scenarioPort, ...(ownsCorePorts ? { web: topology.allocation.webPort, gateway: topology.allocation.gatewayPort } : {}) } : {},
    processExits: topology?.processExitCodes() ?? {},
    artifacts: [],
    redactionState: "verified",
    verdict: input.verdict,
    ...(fluxiqExecution ? { fluxiqExecution } : {}),
    ...(input.workflowId ? { workflowId: input.workflowId } : {}),
    ...(input.variantId ? { variantId: input.variantId } : {}),
    ...(input.automationFailure === undefined ? {} : { automationFailure: input.automationFailure }),
    steps: input.steps,
    actions: input.actions,
  };
}

function cloneRemappingSummary(clonePackage: ClonePackage) {
  const count = (kind: ClonePackage["idMap"][number]["kind"]) => clonePackage.idMap.filter(item => item.kind === kind).length;
  return { projects: count("project"), flows: count("flow"), nodes: count("node"), edges: count("edge"), localReferences: count("local-reference") };
}

function cloneExecutionMetadata(state: CloneRunState, panelVerification?: FluxIQPanelVerificationOutcome): RunManifest["fluxiqExecution"] {
  if (!state.clonePackage || !state.clonePackageHash) return undefined;
  const common = { targetMode: "clone" as const, sourceOrigin: state.clonePackage.source.origin, sourceProjectId: state.clonePackage.source.projectId, sourceFlowId: state.clonePackage.source.flowId, sourceContentHash: state.clonePackage.source.contentHash, sourceSessionIdentityVerified: state.sourceSessionIdentityVerified, clonePackageHash: state.clonePackageHash, dependencyVerdict: state.clonePackage.compatibility.verdict, remappingSummary: cloneRemappingSummary(state.clonePackage), cleanupOutcome: state.cleanupOutcome };
  if (state.destination && state.execution) return { ...common, stage: "executed", destinationProjectId: state.destination.projectId, destinationFlowId: state.destination.flowId, destinationContentHash: state.destination.contentHash, destinationRuntimeRunId: state.execution.runId, sourceHashVerifiedAfterRun: state.sourceHashVerifiedAfterRun, panelVerification: panelVerification?.status ?? "limited" };
  if (state.destination) return { ...common, stage: "imported", destinationProjectId: state.destination.projectId, destinationFlowId: state.destination.flowId, destinationContentHash: state.destination.contentHash };
  return { ...common, stage: "exported" };
}

async function revision(root: string) {
  const safeDirectory = `safe.directory=${path.resolve(root).replaceAll("\\", "/")}`;
  const { stdout } = await execFileAsync("git", ["-c", safeDirectory, "rev-parse", "HEAD"], { cwd: root });
  const statusResult = await execFileAsync("git", ["-c", safeDirectory, "status", "--porcelain"], { cwd: root });
  return { path: path.resolve(root), commit: stdout.trim(), dirty: Boolean(statusResult.stdout.trim()) };
}

async function lockfiles(repositoryRoot: string, fluxiqRepositoryRoot: string) {
  const values = [];
  for (const [root, relative] of [[repositoryRoot, "pnpm-lock.yaml"], [fluxiqRepositoryRoot, "pnpm-lock.yaml"]] as const) {
    try { values.push({ path: path.basename(root) + "/" + relative, sha256: sha256(await readFile(path.join(root, relative))) }); } catch {}
  }
  return values;
}

async function hashDirectory(root: string): Promise<string> {
  const hash = createHash("sha256");
  async function walk(dir: string) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(target);
      else { hash.update(path.relative(root, target)); hash.update(await readFile(target)); }
    }
  }
  await walk(root);
  return hash.digest("hex");
}
