import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { parseRunEvaluationJson, type RunEvaluation } from "@fluxiq-web-extension/test-contracts";
import { createDurableText } from "./durable-file.js";
import { canonicalJson, type CampaignPlanCell } from "./campaign/identity.js";
import { loadCampaignShardGroup, type CampaignShardGroup, type CampaignShardProjectionDigest } from "./campaign/shard-group-store.js";
import { containedPath, loadCampaignCheckpointChain, type CompletedCampaignCell } from "./campaign/store.js";

export type AuthenticatedShardMergeEvaluation = Readonly<{
  cell: CampaignPlanCell;
  evaluation: RunEvaluation;
  completed: CompletedCampaignCell;
}>;

export type AuthenticatedShardMergeInputs = Readonly<{
  group: CampaignShardGroup;
  evaluations: readonly AuthenticatedShardMergeEvaluation[];
  completed: readonly CompletedCampaignCell[];
  childProjections: readonly CampaignShardProjectionDigest[];
}>;

type AcceptedEvaluation = Readonly<{ cell: CampaignPlanCell; evaluation: RunEvaluation; record: CompletedCampaignCell; bytes: Buffer }>;

/**
 * Re-authenticates terminal child authority and receipts, then publishes only
 * byte-identical immutable evaluation copies. Projection and seal publication
 * remain the executor's responsibility.
 */
export async function prepareAuthenticatedShardMerge(directory: string): Promise<AuthenticatedShardMergeInputs> {
  const root = path.resolve(directory);
  const rootReal = await realpath(root);
  const group = await loadCampaignShardGroup(root);
  const acceptedByCell = new Map<string, AcceptedEvaluation>();
  const runIds = new Set<string>();
  const childProjections: CampaignShardProjectionDigest[] = [];

  for (const [index, child] of group.children.entries()) {
    const childDirectory = containedPath(root, `shards/${index.toString().padStart(3, "0")}`);
    await assertContainedDirectory(childDirectory, rootReal, "Shard child directory");
    await assertNoLease(childDirectory);
    const chain = await loadCampaignCheckpointChain(childDirectory, child);
    if (chain.ignored.length !== 0) throw new Error("Shard child checkpoint chain contains ignored generations");
    const terminal = chain.latest;
    if (!terminal || terminal.state !== "finished" || terminal.activeAttempt !== null) throw new Error("Shard child checkpoint chain is not terminal");

    const planned = new Map(child.plan.map((cell) => [cell.cellKey, cell]));
    const expectedNames = new Set(terminal.completed.map(({ evaluation }) => path.basename(evaluation)));
    await assertExactEvaluationFiles(childDirectory, expectedNames);
    for (const record of terminal.completed) {
      const cell = planned.get(record.cellKey);
      if (!cell || cell.skipReason !== null) throw new Error("Shard child completion is orphaned from its executable plan");
      if (acceptedByCell.has(cell.cellKey)) throw new Error("Shard children contain a duplicate completed cell");
      if (runIds.has(record.runId)) throw new Error("Shard children contain a duplicate run id");
      const source = containedPath(childDirectory, record.evaluation);
      await assertContainedFile(source, await realpath(childDirectory), "Shard evaluation");
      const bytes = await readFile(source);
      if (sha256(bytes) !== record.evaluationSha256) throw new Error("Shard evaluation digest does not match its checkpoint receipt");
      const text = bytes.toString("utf8");
      if (!Buffer.from(text, "utf8").equals(bytes)) throw new Error("Shard evaluation is not canonical UTF-8 text");
      const evaluation = parseRunEvaluationJson(text);
      assertEvaluationIdentity(cell, record, evaluation);
      acceptedByCell.set(cell.cellKey, { cell, evaluation, record, bytes });
      runIds.add(record.runId);
    }

    childProjections.push({
      index,
      campaignId: child.benchId,
      terminalCheckpointSha256: terminal.checkpointSha256,
      runsSha256: await fileSha256(containedPath(childDirectory, "runs.json")),
      reportSha256: await fileSha256(containedPath(childDirectory, "report.json")),
      markdownSha256: await fileSha256(containedPath(childDirectory, "report.md")),
    });
  }

  const executable = group.parent.plan.filter(({ skipReason }) => skipReason === null);
  if (acceptedByCell.size !== executable.length || executable.some(({ cellKey }) => !acceptedByCell.has(cellKey))) {
    throw new Error("Shard merge does not exactly cover the executable parent plan");
  }

  const evaluationsDirectory = containedPath(root, "evaluations");
  await mkdir(evaluationsDirectory, { recursive: true });
  await assertContainedDirectory(evaluationsDirectory, rootReal, "Parent evaluations directory");
  const evaluations: AuthenticatedShardMergeEvaluation[] = [];
  for (const cell of executable) {
    const accepted = acceptedByCell.get(cell.cellKey)!;
    const relative = `evaluations/${accepted.record.runId}.json`;
    const target = containedPath(root, relative);
    await createExclusiveOrVerify(target, accepted.bytes);
    const completed = { ...accepted.record, evaluation: relative };
    evaluations.push({ cell, evaluation: accepted.evaluation, completed });
  }

  return { group, evaluations, completed: evaluations.map(({ completed }) => completed), childProjections };
}

function assertEvaluationIdentity(cell: CampaignPlanCell, record: CompletedCampaignCell, evaluation: RunEvaluation): void {
  if (evaluation.runId !== record.runId || evaluation.scenarioId !== cell.scenarioId || evaluation.workflowId !== cell.workflowId || evaluation.variantId !== cell.variantId || evaluation.repeatIndex !== cell.repeatIndex || evaluation.lane !== cell.lane || canonicalJson(evaluation.automationFailureExpected) !== canonicalJson(cell.expectedFailure)) {
    throw new Error("Shard evaluation identity does not match its parent campaign cell");
  }
}

async function assertNoLease(directory: string): Promise<void> {
  try {
    await lstat(containedPath(directory, "lease"));
    throw new Error("Shard child still has a lease");
  } catch (error) {
    if (isMissing(error)) return;
    throw error;
  }
}

async function assertExactEvaluationFiles(directory: string, expected: ReadonlySet<string>): Promise<void> {
  const evaluations = containedPath(directory, "evaluations");
  let names: string[];
  try { names = (await readdir(evaluations)).sort(); } catch (error) {
    if (isMissing(error) && expected.size === 0) return;
    throw error;
  }
  const wanted = [...expected].sort();
  if (canonicalJson(names) !== canonicalJson(wanted)) throw new Error("Shard evaluation directory contains a missing or orphan receipt");
}

async function assertContainedDirectory(directory: string, rootReal: string, label: string): Promise<void> {
  const details = await lstat(directory);
  if (!details.isDirectory() || details.isSymbolicLink()) throw new Error(`${label} must be a direct directory`);
  const resolved = await realpath(directory);
  if (!isInside(rootReal, resolved)) throw new Error(`${label} escapes its campaign root`);
}

async function assertContainedFile(file: string, rootReal: string, label: string): Promise<void> {
  const details = await lstat(file);
  if (!details.isFile() || details.isSymbolicLink()) throw new Error(`${label} must be a direct file`);
  if (!isInside(rootReal, await realpath(file))) throw new Error(`${label} escapes its campaign root`);
}

async function createExclusiveOrVerify(file: string, bytes: Buffer): Promise<void> {
  try {
    await createDurableText(file, bytes.toString("utf8"));
  } catch (error) {
    if (!isExists(error)) throw error;
    const details = await lstat(file);
    if (!details.isFile() || details.isSymbolicLink() || !(await readFile(file)).equals(bytes)) {
      throw new Error("Existing parent evaluation contradicts the authenticated child receipt");
    }
  }
}

async function fileSha256(file: string): Promise<string> {
  const details = await lstat(file);
  if (!details.isFile() || details.isSymbolicLink()) throw new Error("Shard projection input must be a direct file");
  return sha256(await readFile(file));
}

function isInside(root: string, candidate: string): boolean { return candidate.startsWith(`${root}${path.sep}`); }
function sha256(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
function isMissing(error: unknown): boolean { return errorCode(error) === "ENOENT"; }
function isExists(error: unknown): boolean { return errorCode(error) === "EEXIST"; }
function errorCode(error: unknown): string | undefined { return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined; }
