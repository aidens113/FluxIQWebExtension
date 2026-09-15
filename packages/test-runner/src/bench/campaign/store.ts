import { mkdir, readdir, readFile, rename, stat } from "node:fs/promises";
import path from "node:path";
import { createDurableJson, writeDurableJson } from "../durable-file.js";
import { BENCH_ID_PATTERN } from "../report-store.js";
import { BENCH_SEMANTICS_VERSION, CAMPAIGN_SCHEMA_VERSION, campaignCellKey, campaignPlanSha256, canonicalJson, isSha256, sha256Canonical, type CampaignCellIdentity, type CampaignCompatibility, type CampaignExecutionIdentity, type CampaignPlanCell, type CampaignRequest } from "./identity.js";
import { CAMPAIGN_SHARD_ALGORITHM, MAX_CAMPAIGN_SHARDS, MIN_CAMPAIGN_SHARDS } from "./shard-plan.js";

const RUN_ID = /^[A-Za-z0-9._-]{1,160}$/u;
const CHECKPOINT_FILE = /^(\d{12})\.json$/u;
const SECRET_KEY = /(?:^|[_-])(authorization|bearer|cookie|credential|password|pin|secret|session|token)(?:$|[_-])|(?:api|access|private)[_-]?key/iu;
const EXACT_SHA = /^[0-9a-f]{64}$/u;

export type CampaignManifest = Readonly<{
  schemaVersion: typeof CAMPAIGN_SCHEMA_VERSION;
  benchId: string;
  createdAt: string;
  benchSemanticsVersion: string;
  request: CampaignRequest;
  plan: readonly CampaignPlanCell[];
  planSha256: string;
  compatibility: CampaignCompatibility;
  execution: CampaignExecutionIdentity;
}>;

export type CompletedCampaignCell = Readonly<{
  cellKey: string;
  runId: string;
  evaluation: string;
  evaluationSha256: string;
}>;

export type ActiveCampaignAttempt = Readonly<{
  cellKey: string;
  ordinal: number;
  attempt: number;
  runId: string;
  startedAt: string;
}>;

export type CampaignCheckpoint = Readonly<{
  schemaVersion: typeof CAMPAIGN_SCHEMA_VERSION;
  generation: number;
  previousSha256: string | null;
  campaignId: string;
  planSha256: string;
  completed: readonly CompletedCampaignCell[];
  activeAttempt: ActiveCampaignAttempt | null;
  state: "running" | "aggregating" | "finished";
  checkpointSha256: string;
}>;

export type CampaignCheckpointInput = Omit<CampaignCheckpoint, "schemaVersion" | "checkpointSha256">;
export type LoadedCheckpointChain = Readonly<{ checkpoints: readonly CampaignCheckpoint[]; latest: CampaignCheckpoint | null; ignored: readonly string[] }>;

export async function writeCampaignManifest(directory: string, manifest: CampaignManifest): Promise<string> {
  const checked = parseCampaignManifest(manifest);
  const file = containedPath(directory, "campaign.json");
  await mkdir(path.resolve(directory), { recursive: true });
  await createDurableJson(file, checked);
  return file;
}

export async function loadCampaignManifest(directory: string): Promise<CampaignManifest> {
  return parseCampaignManifest(JSON.parse(await readFile(containedPath(directory, "campaign.json"), "utf8")));
}

export function parseCampaignManifest(value: unknown): CampaignManifest {
  refuseCampaignSecretKeys(value);
  const object = exactObject(value, ["schemaVersion", "benchId", "createdAt", "benchSemanticsVersion", "request", "plan", "planSha256", "compatibility", "execution"], "campaign manifest");
  if (object.schemaVersion !== CAMPAIGN_SCHEMA_VERSION) throw new Error("Campaign manifest schemaVersion must be 0.3");
  const benchId = benchIdOf(object.benchId);
  const createdAt = isoDate(object.createdAt, "createdAt");
  if (object.benchSemanticsVersion !== BENCH_SEMANTICS_VERSION) throw new Error(`Unsupported benchSemanticsVersion: ${String(object.benchSemanticsVersion)}`);
  const request = parseRequest(object.request);
  const plan = parsePlan(object.plan, request.repeatCount);
  const planSha256 = sha(object.planSha256, "planSha256");
  if (campaignPlanSha256(plan) !== planSha256) throw new Error("Campaign planSha256 does not match its canonical plan");
  const compatibility = parseCompatibility(object.compatibility);
  const execution = parseExecution(object.execution);
  return { schemaVersion: CAMPAIGN_SCHEMA_VERSION, benchId, createdAt, benchSemanticsVersion: BENCH_SEMANTICS_VERSION, request, plan, planSha256, compatibility, execution };
}

export async function writeCampaignCheckpoint(directory: string, input: CampaignCheckpointInput): Promise<CampaignCheckpoint> {
  const unsigned = { schemaVersion: CAMPAIGN_SCHEMA_VERSION, ...input };
  const checkpoint = parseCampaignCheckpoint({ ...unsigned, checkpointSha256: sha256Canonical(unsigned) });
  const checkpointDirectory = containedPath(directory, "checkpoints");
  await mkdir(checkpointDirectory, { recursive: true });
  await createDurableJson(containedPath(checkpointDirectory, checkpointName(checkpoint.generation)), checkpoint);
  return checkpoint;
}

/** Atomically replaces a non-authoritative campaign projection such as runs.json. */
export async function writeCampaignProjection(directory: string, relative: string, value: unknown): Promise<string> {
  refuseCampaignSecretKeys(value);
  const file = containedPath(directory, relative);
  await writeDurableJson(file, value);
  return file;
}

/** Loads only the longest contiguous valid chain starting at generation zero. */
export async function loadCampaignCheckpointChain(directory: string, manifest: CampaignManifest): Promise<LoadedCheckpointChain> {
  const checkpointDirectory = containedPath(directory, "checkpoints");
  let names: string[];
  try { names = await readdir(checkpointDirectory); } catch (error) {
    if (isMissing(error)) return { checkpoints: [], latest: null, ignored: [] };
    throw error;
  }
  const ignored = names.filter((name) => !CHECKPOINT_FILE.test(name)).sort();
  const numbered = names.flatMap((name) => {
    const match = CHECKPOINT_FILE.exec(name);
    return match ? [{ name, generation: Number(match[1]) }] : [];
  }).sort((left, right) => left.generation - right.generation);
  const chain: CampaignCheckpoint[] = [];
  let expected = 0;
  for (const candidate of numbered) {
    if (candidate.generation !== expected) { ignored.push(candidate.name); continue; }
    const checkpoint = parseCampaignCheckpoint(JSON.parse(await readFile(containedPath(checkpointDirectory, candidate.name), "utf8")));
    if (checkpoint.generation !== candidate.generation) throw new Error(`Checkpoint ${candidate.name} generation contradicts its file name`);
    if (checkpoint.campaignId !== manifest.benchId || checkpoint.planSha256 !== manifest.planSha256) throw new Error(`Checkpoint ${candidate.name} does not belong to this campaign plan`);
    const previous = chain.at(-1);
    const requiredLink = previous?.checkpointSha256 ?? null;
    if (checkpoint.previousSha256 !== requiredLink) throw new Error(`Checkpoint ${candidate.name} has an invalid previousSha256 link`);
    validateCheckpointCells(checkpoint, manifest);
    chain.push(checkpoint);
    expected += 1;
  }
  return { checkpoints: chain, latest: chain.at(-1) ?? null, ignored: ignored.sort() };
}

export function parseCampaignCheckpoint(value: unknown): CampaignCheckpoint {
  refuseCampaignSecretKeys(value);
  const object = exactObject(value, ["schemaVersion", "generation", "previousSha256", "campaignId", "planSha256", "completed", "activeAttempt", "state", "checkpointSha256"], "campaign checkpoint");
  if (object.schemaVersion !== CAMPAIGN_SCHEMA_VERSION) throw new Error("Campaign checkpoint schemaVersion must be 0.3");
  integer(object.generation, "generation");
  const generation = object.generation as number;
  const previousSha256 = object.previousSha256 === null ? null : sha(object.previousSha256, "previousSha256");
  const campaignId = benchIdOf(object.campaignId);
  const planSha256 = sha(object.planSha256, "planSha256");
  if (!Array.isArray(object.completed)) throw new Error("Campaign checkpoint completed must be an array");
  const completed = object.completed.map(parseCompleted);
  const activeAttempt = object.activeAttempt === null ? null : parseActive(object.activeAttempt);
  if (object.state !== "running" && object.state !== "aggregating" && object.state !== "finished") throw new Error("Campaign checkpoint state is invalid");
  const state: CampaignCheckpoint["state"] = object.state;
  const checkpointSha256 = sha(object.checkpointSha256, "checkpointSha256");
  const unsigned = { schemaVersion: CAMPAIGN_SCHEMA_VERSION, generation, previousSha256, campaignId, planSha256, completed, activeAttempt, state };
  if (sha256Canonical(unsigned) !== checkpointSha256) throw new Error("Campaign checkpoint hash does not match its canonical content");
  return { ...unsigned, checkpointSha256 };
}

/** Resolves a campaign-owned relative path and refuses escape, absolute input, or aliases. */
export function containedPath(directory: string, relative: string): string {
  if (typeof relative !== "string" || relative.length < 1 || path.isAbsolute(relative) || relative.includes("\\")) throw new Error("Campaign path must be a non-empty portable relative path");
  const segments = relative.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === ".." || segment.includes(":"))) throw new Error("Campaign path contains a non-portable or aliased segment");
  const root = path.resolve(directory);
  const resolved = path.resolve(root, ...segments);
  if (resolved === root || !resolved.startsWith(`${root}${path.sep}`)) throw new Error(`Campaign path escapes its directory: ${relative}`);
  return resolved;
}

export async function preserveInterruptedStaging(directory: string, stagingPath: string, runId: string, allowedSourceRoot = directory): Promise<string> {
  if (!RUN_ID.test(runId)) throw new Error("Interrupted run id is unsafe");
  const root = path.resolve(allowedSourceRoot);
  const source = path.resolve(stagingPath);
  if (!source.startsWith(`${root}${path.sep}`)) throw new Error("Interrupted staging directory is outside the campaign directory");
  if (path.basename(source) !== `.staging-${runId}`) throw new Error("Interrupted staging directory does not match its run id");
  if (!(await stat(source)).isDirectory()) throw new Error("Interrupted staging path is not a directory");
  const destination = containedPath(directory, `interrupted/${runId}`);
  await mkdir(path.dirname(destination), { recursive: true });
  await rename(source, destination);
  return destination;
}

function parsePlan(value: unknown, repeatCount: number): CampaignPlanCell[] {
  if (!Array.isArray(value)) throw new Error("Campaign plan must be an array");
  const cells = value.map((item, index): CampaignPlanCell => {
    const object = exactObject(item, ["corpusRowId", "scenarioId", "workflowId", "variantId", "lane", "repeatIndex", "ordinal", "cellKey", "resolved", "expectedFailure", "skipReason"], `plan[${index}]`);
    if (object.ordinal !== index) throw new Error(`plan[${index}] ordinal must equal its array position`);
    integer(object.repeatIndex, `plan[${index}].repeatIndex`);
    if ((object.repeatIndex as number) >= repeatCount) throw new Error(`plan[${index}] repeatIndex is outside request.repeatCount`);
    if (object.lane !== "recording" && object.lane !== "flow") throw new Error(`plan[${index}] lane is invalid`);
    if (typeof object.resolved !== "boolean") throw new Error(`plan[${index}] resolved must be boolean`);
    const identity = parseCellIdentity(object, `plan[${index}]`);
    const cellKey = sha(object.cellKey, `plan[${index}].cellKey`);
    if (campaignCellKey(identity) !== cellKey) throw new Error(`plan[${index}] cellKey does not match its identity`);
    if (object.skipReason !== null && typeof object.skipReason !== "string") throw new Error(`plan[${index}] skipReason is invalid`);
    const expectedFailure = parseExpectedFailure(object.expectedFailure, `plan[${index}].expectedFailure`);
    return { ...identity, ordinal: index, cellKey, resolved: object.resolved, expectedFailure, skipReason: object.skipReason as string | null };
  });
  if (new Set(cells.map(({ cellKey }) => cellKey)).size !== cells.length) throw new Error("Campaign plan contains duplicate cell keys");
  return cells;
}

function parseCellIdentity(object: Record<string, unknown>, label: string): CampaignCellIdentity {
  const text = (name: string): string => { const value = object[name]; if (typeof value !== "string" || value.length < 1 || value.length > 200) throw new Error(`${label}.${name} is invalid`); return value; };
  const nullable = (name: string): string | null => object[name] === null ? null : text(name);
  integer(object.repeatIndex, `${label}.repeatIndex`);
  if (object.lane !== "recording" && object.lane !== "flow") throw new Error(`${label}.lane is invalid`);
  return { corpusRowId: text("corpusRowId"), scenarioId: text("scenarioId"), workflowId: nullable("workflowId"), variantId: nullable("variantId"), lane: object.lane, repeatIndex: object.repeatIndex as number };
}

function parseRequest(value: unknown): CampaignRequest {
  const object = exactObject(value, ["corpusId", "repeatCount", "target", "evidence"], "campaign request");
  if (typeof object.corpusId !== "string" || object.corpusId.length < 1) throw new Error("campaign request corpusId is invalid");
  integer(object.repeatCount, "campaign request repeatCount", true);
  const target = exactObject(object.target, ["mode", "workspace"], "campaign request target");
  if (target.mode !== "isolated" && target.mode !== "persistent-isolated") throw new Error("campaign request target mode is invalid");
  if (target.workspace !== null && (typeof target.workspace !== "string" || target.workspace.length < 1)) throw new Error("campaign request workspace is invalid");
  if (object.evidence !== null && object.evidence !== "none" && object.evidence !== "failure" && object.evidence !== "checkpoints" && object.evidence !== "events") throw new Error("campaign request evidence is invalid");
  return { corpusId: object.corpusId, repeatCount: object.repeatCount as number, target: { mode: target.mode, workspace: target.workspace as string | null }, evidence: object.evidence } as CampaignRequest;
}

function parseCompatibility(value: unknown): CampaignCompatibility {
  const root = exactObject(value, ["repositories", "lockfiles", "builds", "environment"], "compatibility");
  const repositories = exactObject(root.repositories, ["facilityCommit", "coreCommit"], "compatibility.repositories");
  const lockfiles = exactObject(root.lockfiles, ["facilitySha256", "coreSha256"], "compatibility.lockfiles");
  const builds = exactObject(root.builds, ["testRunnerSha256", "extensionSha256", "scenarioLabSha256"], "compatibility.builds");
  const environment = exactObject(root.environment, ["platform", "architecture", "browserName", "browserVersion", "locale", "timezone", "viewport"], "compatibility.environment");
  const viewport = exactObject(environment.viewport, ["width", "height"], "compatibility.environment.viewport");
  const commit = (value: unknown, name: string): string => { if (typeof value !== "string" || !/^[0-9a-f]{40}$/u.test(value)) throw new Error(`${name} is invalid`); return value; };
  const text = (value: unknown, name: string): string => { if (typeof value !== "string" || value.length < 1 || value.length > 200) throw new Error(`${name} is invalid`); return value; };
  integer(viewport.width, "viewport.width", true); integer(viewport.height, "viewport.height", true);
  return {
    repositories: { facilityCommit: commit(repositories.facilityCommit, "facilityCommit"), coreCommit: commit(repositories.coreCommit, "coreCommit") },
    lockfiles: { facilitySha256: sha(lockfiles.facilitySha256, "facilitySha256"), coreSha256: sha(lockfiles.coreSha256, "coreSha256") },
    builds: { testRunnerSha256: sha(builds.testRunnerSha256, "testRunnerSha256"), extensionSha256: sha(builds.extensionSha256, "extensionSha256"), scenarioLabSha256: sha(builds.scenarioLabSha256, "scenarioLabSha256") },
    environment: { platform: text(environment.platform, "platform"), architecture: text(environment.architecture, "architecture"), browserName: text(environment.browserName, "browserName"), browserVersion: text(environment.browserVersion, "browserVersion"), locale: text(environment.locale, "locale"), timezone: text(environment.timezone, "timezone"), viewport: { width: viewport.width as number, height: viewport.height as number } },
  };
}

function parseExpectedFailure(value: unknown, label: string): CampaignPlanCell["expectedFailure"] {
  if (value === null) return null;
  const object = exactObject(value, Object.prototype.hasOwnProperty.call(value, "code") ? ["category", "code"] : ["category"], label);
  if (typeof object.category !== "string" || object.category.length < 1 || object.category.length > 100) throw new Error(`${label}.category is invalid`);
  if ("code" in object && (typeof object.code !== "string" || object.code.length < 1 || object.code.length > 100)) throw new Error(`${label}.code is invalid`);
  return { category: object.category, ...(typeof object.code === "string" ? { code: object.code } : {}) } as CampaignPlanCell["expectedFailure"];
}

function parseExecution(value: unknown): CampaignExecutionIdentity {
  if (!isRecord(value) || typeof value.mode !== "string") throw new Error("campaign execution identity is invalid");
  if (value.mode === "serial") {
    exactObject(value, ["mode"], "campaign execution identity");
    return { mode: "serial" };
  }
  if (value.mode === "shard-parent") {
    const object = exactObject(value, ["mode", "algorithm", "shardCount", "jobs"], "campaign execution identity");
    shardAlgorithm(object.algorithm); validShardCount(object.shardCount); validJobs(object.jobs, object.shardCount as number);
    return { mode: "shard-parent", algorithm: CAMPAIGN_SHARD_ALGORITHM, shardCount: object.shardCount as number, jobs: object.jobs as number };
  }
  if (value.mode === "shard-child") {
    const object = exactObject(value, ["mode", "algorithm", "parentCampaignId", "parentPlanSha256", "shardIndex", "shardCount"], "campaign execution identity");
    shardAlgorithm(object.algorithm); validShardCount(object.shardCount); integer(object.shardIndex, "shardIndex");
    if ((object.shardIndex as number) >= (object.shardCount as number)) throw new Error("shardIndex must be less than shardCount");
    return { mode: "shard-child", algorithm: CAMPAIGN_SHARD_ALGORITHM, parentCampaignId: benchIdOf(object.parentCampaignId), parentPlanSha256: sha(object.parentPlanSha256, "parentPlanSha256"), shardIndex: object.shardIndex as number, shardCount: object.shardCount as number };
  }
  throw new Error("campaign execution mode is invalid");
}

function shardAlgorithm(value: unknown): void { if (value !== CAMPAIGN_SHARD_ALGORITHM) throw new Error("campaign shard algorithm is invalid"); }
function validShardCount(value: unknown): void { integer(value, "shardCount", true); if ((value as number) < MIN_CAMPAIGN_SHARDS || (value as number) > MAX_CAMPAIGN_SHARDS) throw new Error(`shardCount must be between ${MIN_CAMPAIGN_SHARDS} and ${MAX_CAMPAIGN_SHARDS}`); }
function validJobs(value: unknown, shardCount: number): void { integer(value, "jobs", true); if ((value as number) > shardCount) throw new Error("jobs must be less than or equal to shardCount"); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

function parseCompleted(value: unknown): CompletedCampaignCell {
  const object = exactObject(value, ["cellKey", "runId", "evaluation", "evaluationSha256"], "completed campaign cell");
  if (typeof object.runId !== "string" || !RUN_ID.test(object.runId)) throw new Error("Completed campaign runId is unsafe");
  if (typeof object.evaluation !== "string" || !/^evaluations\/[A-Za-z0-9._-]{1,160}\.json$/u.test(object.evaluation)) throw new Error("Completed campaign evaluation path is unsafe");
  return { cellKey: sha(object.cellKey, "cellKey"), runId: object.runId, evaluation: object.evaluation, evaluationSha256: sha(object.evaluationSha256, "evaluationSha256") };
}

function parseActive(value: unknown): ActiveCampaignAttempt {
  const object = exactObject(value, ["cellKey", "ordinal", "attempt", "runId", "startedAt"], "active campaign attempt");
  integer(object.ordinal, "active ordinal"); integer(object.attempt, "active attempt", true);
  if (typeof object.runId !== "string" || !RUN_ID.test(object.runId)) throw new Error("Active campaign runId is unsafe");
  return { cellKey: sha(object.cellKey, "active cellKey"), ordinal: object.ordinal as number, attempt: object.attempt as number, runId: object.runId, startedAt: isoDate(object.startedAt, "active startedAt") };
}

function validateCheckpointCells(checkpoint: CampaignCheckpoint, manifest: CampaignManifest): void {
  const planned = new Map(manifest.plan.map((cell) => [cell.cellKey, cell]));
  const completed = new Set<string>();
  for (const record of checkpoint.completed) {
    const cell = planned.get(record.cellKey);
    if (!cell || cell.skipReason !== null) throw new Error("Checkpoint completes an unknown or skipped cell");
    if (completed.has(record.cellKey)) throw new Error("Checkpoint contains a duplicate completed cell");
    completed.add(record.cellKey);
  }
  if (checkpoint.activeAttempt) {
    const cell = planned.get(checkpoint.activeAttempt.cellKey);
    if (!cell || cell.ordinal !== checkpoint.activeAttempt.ordinal || cell.skipReason !== null || completed.has(cell.cellKey)) throw new Error("Checkpoint active attempt is not one incomplete executable plan cell");
  }
  if (checkpoint.state === "finished" && (checkpoint.activeAttempt !== null || manifest.plan.some((cell) => cell.skipReason === null && !completed.has(cell.cellKey)))) throw new Error("Finished checkpoint does not cover every executable plan cell exactly once");
}

function exactObject(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const object = value as Record<string, unknown>;
  const actual = Object.keys(object).sort(); const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(`${label} has unexpected or missing keys`);
  return object;
}

export function refuseCampaignSecretKeys(value: unknown, at = "$", seen = new Set<object>()): void {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) throw new Error(`Campaign data contains a cycle at ${at}`);
  seen.add(value);
  if (Array.isArray(value)) value.forEach((item, index) => refuseCampaignSecretKeys(item, `${at}[${index}]`, seen));
  else for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.replace(/([a-z0-9])([A-Z])/gu, "$1_$2");
    if (SECRET_KEY.test(normalizedKey)) throw new Error(`Campaign data refuses secret-bearing key ${key}`);
    refuseCampaignSecretKeys(child, `${at}.${key}`, seen);
  }
  seen.delete(value);
}

function sha(value: unknown, name: string): string { if (!isSha256(value) || !EXACT_SHA.test(value)) throw new Error(`${name} must be a lowercase SHA-256 digest`); return value; }
function benchIdOf(value: unknown): string { if (typeof value !== "string" || !BENCH_ID_PATTERN.test(value)) throw new Error("Campaign benchId is invalid"); return value; }
function isoDate(value: unknown, name: string): string { if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new Error(`${name} must be a canonical ISO timestamp`); return value; }
function integer(value: unknown, name: string, positive = false): void { if (!Number.isSafeInteger(value) || (positive ? (value as number) < 1 : (value as number) < 0)) throw new Error(`${name} must be a ${positive ? "positive" : "non-negative"} safe integer`); }
function checkpointName(generation: number): string { integer(generation, "generation"); return `${generation.toString().padStart(12, "0")}.json`; }
function isMissing(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT"; }
