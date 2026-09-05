import type { RunManifest } from "./run.js";
import { ContractValidationError, type ValidationIssue, type ValidationResult } from "./validation.js";
import { add, array, date, enumeration, finite, keys, object, parseJson, result, safeRelativePath, sha256, text, uniqueStrings, type Check } from "./runtime-validation.js";

const statuses = ["created", "running", "passed", "failed", "aborted"] as const;
const verdicts = ["passed", "failed", "inconclusive"] as const;

const repository: Check = (input, path, issues) => {
  const value = object(input, path, issues); if (!value) return;
  keys(value, ["path", "commit", "dirty"], path, issues); text(value, "path", path, issues);
  if (typeof value.commit !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value.commit)) add(issues, `${path}.commit`, "must be a full lowercase Git commit digest");
  if (typeof value.dirty !== "boolean") add(issues, `${path}.dirty`, "must be a boolean");
};
const compatibility: Check = (input, path, issues) => {
  const value = object(input, path, issues); if (!value) return;
  keys(value, ["packageName", "requested", "resolvedVersion", "source", "integrity"], path, issues);
  for (const key of ["packageName", "requested", "resolvedVersion", "source"] as const) text(value, key, path, issues);
  if (value.integrity !== undefined && (typeof value.integrity !== "string" || value.integrity.length === 0)) add(issues, `${path}.integrity`, "must be a non-empty string");
};
const artifact: Check = (input, path, issues) => {
  const value = object(input, path, issues); if (!value) return;
  keys(value, ["path", "mediaType", "sha256", "bytes", "redaction"], path, issues);
  safeRelativePath(value.path, `${path}.path`, issues);
  if (typeof value.mediaType !== "string" || !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/iu.test(value.mediaType)) add(issues, `${path}.mediaType`, "must be a valid media type");
  sha256(value.sha256, `${path}.sha256`, issues); finite(value.bytes, `${path}.bytes`, issues, 0, Number.MAX_SAFE_INTEGER, true);
  enumeration(value.redaction, ["not-required", "applied", "verified"], `${path}.redaction`, issues);
};

export function validateRunManifest(input: unknown): ValidationResult<RunManifest> {
  const issues: ValidationIssue[] = []; const value = object(input, "$", issues); if (!value) return result(input, issues);
  keys(value, ["schemaVersion", "runId", "scenarioId", "scenarioRevision", "seed", "status", "startedAt", "finishedAt", "repositories", "compatibility", "lockfiles", "extension", "environment", "ports", "processExits", "artifacts", "redactionState", "verdict", "fluxiqExecution"], "$", issues);
  if (value.schemaVersion !== "0.1") add(issues, "$.schemaVersion", "must equal 0.1");
  for (const key of ["runId", "scenarioId", "scenarioRevision"] as const) text(value, key, "$", issues);
  finite(value.seed, "$.seed", issues, 0, 0xffffffff, true); enumeration(value.status, statuses, "$.status", issues); date(value.startedAt, "$.startedAt", issues);
  if (value.finishedAt !== undefined) date(value.finishedAt, "$.finishedAt", issues);
  const repositories = object(value.repositories, "$.repositories", issues);
  if (repositories) { keys(repositories, ["facility", "core"], "$.repositories", issues); repository(repositories.facility, "$.repositories.facility", issues); repository(repositories.core, "$.repositories.core", issues); }
  array(value.compatibility, "$.compatibility", issues, compatibility);
  if (Array.isArray(value.compatibility)) uniqueStrings(value.compatibility.filter(objectValue).map(entry => entry.packageName), "$.compatibility", issues, "package names");
  array(value.lockfiles, "$.lockfiles", issues, (entry, path, target) => { const lock = object(entry, path, target); if (!lock) return; keys(lock, ["path", "sha256"], path, target); safeRelativePath(lock.path, `${path}.path`, target); sha256(lock.sha256, `${path}.sha256`, target); });
  if (Array.isArray(value.lockfiles)) uniqueStrings(value.lockfiles.filter(objectValue).map(entry => entry.path), "$.lockfiles", issues, "lockfile paths");
  const extension = object(value.extension, "$.extension", issues); if (extension) { keys(extension, ["version", "sha256", "path"], "$.extension", issues); text(extension, "version", "$.extension", issues); sha256(extension.sha256, "$.extension.sha256", issues); safeRelativePath(extension.path, "$.extension.path", issues); }
  validateEnvironment(value.environment, issues); validateNumericRecord(value.ports, "$.ports", issues, 1, 65535, false); validateNumericRecord(value.processExits, "$.processExits", issues, -2147483648, 2147483647, true);
  array(value.artifacts, "$.artifacts", issues, artifact);
  if (Array.isArray(value.artifacts)) uniqueStrings(value.artifacts.filter(objectValue).map(entry => entry.path), "$.artifacts", issues, "artifact paths");
  enumeration(value.redactionState, ["pending", "verified", "failed"], "$.redactionState", issues);
  if (value.verdict !== undefined) enumeration(value.verdict, verdicts, "$.verdict", issues);
  if (value.fluxiqExecution !== undefined) validateFluxIQExecution(value.fluxiqExecution, issues);
  validateStatusConsistency(value, issues);
  return result(input, issues);
}

function validateFluxIQExecution(input: unknown, issues: ValidationIssue[]): void {
  const path = "$.fluxiqExecution";
  const value = object(input, path, issues); if (!value) return;
  enumeration(value.targetMode, ["isolated", "persistent-isolated", "existing", "clone"], `${path}.targetMode`, issues);
  if (value.targetMode === "isolated") {
    keys(value, ["targetMode"], path, issues);
    return;
  }
  if (value.targetMode === "persistent-isolated") {
    keys(value, ["targetMode", "workspace"], path, issues);
    persistentWorkspaceName(value.workspace, `${path}.workspace`, issues);
    return;
  }
  if (value.targetMode === "existing") {
    keys(value, ["targetMode", "origin", "projectId", "flowId", "flowContentHash", "runtimeRunId", "runtimeId", "sessionIdentityVerified", "panelVerification"], path, issues);
    sanitizedOrigin(value.origin, `${path}.origin`, issues);
    for (const key of ["projectId", "flowId", "runtimeRunId"] as const) boundedText(value, key, path, issues);
    if (value.runtimeId !== undefined) boundedText(value, "runtimeId", path, issues);
    sha256(value.flowContentHash, `${path}.flowContentHash`, issues);
    if (typeof value.sessionIdentityVerified !== "boolean") add(issues, `${path}.sessionIdentityVerified`, "must be a boolean");
    enumeration(value.panelVerification, ["verified", "limited"], `${path}.panelVerification`, issues);
    return;
  }
  if (value.targetMode !== "clone") return;
  enumeration(value.stage, ["exported", "imported", "executed"], `${path}.stage`, issues);
  const common = ["targetMode", "stage", "sourceOrigin", "sourceProjectId", "sourceFlowId", "sourceContentHash", "sourceSessionIdentityVerified", "clonePackageHash", "dependencyVerdict", "remappingSummary", "cleanupOutcome"];
  const destination = ["destinationProjectId", "destinationFlowId", "destinationContentHash"];
  const executed = ["destinationRuntimeRunId", "sourceHashVerifiedAfterRun", "panelVerification"];
  keys(value, [...common, ...(value.stage === "imported" || value.stage === "executed" ? destination : []), ...(value.stage === "executed" ? executed : [])], path, issues);
  sanitizedOrigin(value.sourceOrigin, `${path}.sourceOrigin`, issues);
  for (const key of ["sourceProjectId", "sourceFlowId"] as const) boundedText(value, key, path, issues);
  for (const key of ["sourceContentHash", "clonePackageHash"] as const) sha256(value[key], `${path}.${key}`, issues);
  if (typeof value.sourceSessionIdentityVerified !== "boolean") add(issues, `${path}.sourceSessionIdentityVerified`, "must be a boolean");
  enumeration(value.dependencyVerdict, ["compatible", "incompatible"], `${path}.dependencyVerdict`, issues);
  enumeration(value.cleanupOutcome, ["pending", "completed", "failed"], `${path}.cleanupOutcome`, issues);
  const summary = object(value.remappingSummary, `${path}.remappingSummary`, issues);
  if (summary) {
    keys(summary, ["projects", "flows", "nodes", "edges", "localReferences"], `${path}.remappingSummary`, issues);
    for (const key of ["projects", "flows", "nodes", "edges", "localReferences"] as const) finite(summary[key], `${path}.remappingSummary.${key}`, issues, 0, Number.MAX_SAFE_INTEGER, true);
    if (summary.projects !== 1) add(issues, `${path}.remappingSummary.projects`, "must equal 1");
    if (summary.flows !== 1) add(issues, `${path}.remappingSummary.flows`, "must equal 1");
  }
  if (value.stage === "imported" || value.stage === "executed") {
    for (const key of ["destinationProjectId", "destinationFlowId"] as const) boundedText(value, key, path, issues);
    sha256(value.destinationContentHash, `${path}.destinationContentHash`, issues);
  }
  if (value.stage === "executed") {
    boundedText(value, "destinationRuntimeRunId", path, issues);
    if (typeof value.sourceHashVerifiedAfterRun !== "boolean") add(issues, `${path}.sourceHashVerifiedAfterRun`, "must be a boolean");
    enumeration(value.panelVerification, ["verified", "limited"], `${path}.panelVerification`, issues);
  }
}

function persistentWorkspaceName(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof input !== "string" || !/^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/u.test(input)) {
    add(issues, path, "must be a lowercase filesystem-safe workspace name of 1 to 64 characters");
    return;
  }
  const dotIndex = input.indexOf(".");
  const windowsStem = dotIndex === -1 ? input : input.slice(0, dotIndex);
  if (/^(?:con|prn|aux|nul|clock\$|com[1-9]|lpt[1-9])$/u.test(windowsStem)) {
    add(issues, path, "must not use a reserved Windows device name");
  } else if (input === "persistent-isolated" || input === "sessions") {
    add(issues, path, "must not use a facility-reserved workspace name");
  }
}

function boundedText(value: Record<string, unknown>, key: string, path: string, issues: ValidationIssue[]): void {
  const entry = value[key];
  if (typeof entry !== "string" || entry.length === 0 || entry.length > 256 || entry.trim() !== entry) add(issues, `${path}.${key}`, "must be a trimmed non-empty string of at most 256 characters");
}

function sanitizedOrigin(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof input !== "string") { add(issues, path, "must be an exact HTTP(S) origin without credentials, path, query, or fragment"); return; }
  try {
    const value = new URL(input);
    if ((value.protocol !== "http:" && value.protocol !== "https:") || value.username !== "" || value.password !== "" || input !== value.origin) {
      add(issues, path, "must be an exact HTTP(S) origin without credentials, path, query, or fragment");
    }
  } catch {
    add(issues, path, "must be an exact HTTP(S) origin without credentials, path, query, or fragment");
  }
}

export function assertRunManifest(input: unknown): asserts input is RunManifest { const checked = validateRunManifest(input); if (!checked.valid) throw new ContractValidationError("RunManifest", checked.issues); }
export function parseRunManifestJson(json: string): RunManifest { let input: unknown; try { input = parseJson(json, "RunManifest"); } catch (error) { throw new ContractValidationError("RunManifest", [{ path: "$", message: error instanceof Error ? error.message : String(error) }]); } assertRunManifest(input); return input; }

function validateEnvironment(input: unknown, issues: ValidationIssue[]): void {
  const value = object(input, "$.environment", issues); if (!value) return;
  keys(value, ["os", "architecture", "browserName", "browserVersion", "locale", "timezone", "viewport"], "$.environment", issues);
  for (const key of ["os", "architecture", "browserName", "browserVersion", "locale", "timezone"] as const) text(value, key, "$.environment", issues);
  const viewport = object(value.viewport, "$.environment.viewport", issues); if (viewport) { keys(viewport, ["width", "height"], "$.environment.viewport", issues); finite(viewport.width, "$.environment.viewport.width", issues, 1, 16384, true); finite(viewport.height, "$.environment.viewport.height", issues, 1, 16384, true); }
}
function validateNumericRecord(input: unknown, path: string, issues: ValidationIssue[], minimum: number, maximum: number, allowNull: boolean): void {
  const value = object(input, path, issues); if (!value) return;
  for (const [key, entry] of Object.entries(value)) { if (!key) add(issues, path, "keys must be non-empty"); else if (!(allowNull && entry === null)) finite(entry, `${path}.${key}`, issues, minimum, maximum, true); }
}
function validateStatusConsistency(value: Record<string, unknown>, issues: ValidationIssue[]): void {
  const terminal = ["passed", "failed", "aborted"].includes(String(value.status));
  if (terminal && value.finishedAt === undefined) add(issues, "$.finishedAt", "is required for terminal status");
  if (!terminal && value.finishedAt !== undefined) add(issues, "$.finishedAt", "must be absent before terminal status");
  const expected = value.status === "passed" ? "passed" : value.status === "failed" ? "failed" : value.status === "aborted" ? "inconclusive" : undefined;
  if (expected && value.verdict !== expected) add(issues, "$.verdict", `must equal ${expected} for ${String(value.status)} status`);
  if (!expected && value.verdict !== undefined) add(issues, "$.verdict", "must be absent before terminal status");
  if (value.redactionState === "failed" && value.verdict === "passed") add(issues, "$.verdict", "cannot pass when redaction failed");
  if (typeof value.startedAt === "string" && typeof value.finishedAt === "string" && Date.parse(value.finishedAt) < Date.parse(value.startedAt)) add(issues, "$.finishedAt", "must not precede startedAt");
  if (value.redactionState === "verified" && Array.isArray(value.artifacts) && value.artifacts.filter(objectValue).some(item => item.redaction === "applied")) add(issues, "$.redactionState", "cannot be verified while an artifact is only marked applied");
}
const objectValue = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
