import type { EvidenceEvent, EvidencePolicy } from "./evidence.js";
import { ContractValidationError, type ValidationIssue, type ValidationResult } from "./validation.js";
import { add, array, date, enumeration, finite, keys, object, parseJson, result, sha256, text } from "./runtime-validation.js";

const triggers = ["step.start", "step.complete", "gateway.action", "runtime.dispatch", "runtime.settle", "navigation", "state.change", "error", "checkpoint", "final"] as const;

export function validateEvidenceEvent(input: unknown): ValidationResult<EvidenceEvent> {
  const issues: ValidationIssue[] = []; checkEvent(input, "$", issues); return result(input, issues);
}
export function validateEvidenceEvents(input: unknown): ValidationResult<EvidenceEvent[]> {
  const issues: ValidationIssue[] = []; array(input, "$", issues, checkEvent);
  if (Array.isArray(input)) {
    const sequences = input.filter(isRecord).map(event => event.sequence).filter((value): value is number => typeof value === "number");
    if (new Set(sequences).size !== sequences.length) add(issues, "$", "event sequences must be unique");
    for (let index = 1; index < sequences.length; index += 1) if ((sequences[index] ?? 0) <= (sequences[index - 1] ?? 0)) { add(issues, "$", "event sequences must be strictly increasing"); break; }
  }
  return result(input, issues);
}
export function assertEvidenceEvent(input: unknown): asserts input is EvidenceEvent { const checked = validateEvidenceEvent(input); if (!checked.valid) throw new ContractValidationError("EvidenceEvent", checked.issues); }
export function assertEvidenceEvents(input: unknown): asserts input is EvidenceEvent[] { const checked = validateEvidenceEvents(input); if (!checked.valid) throw new ContractValidationError("EvidenceEvent[]", checked.issues); }
export function parseEvidenceEventJson(json: string): EvidenceEvent { const input = parse(json, "EvidenceEvent"); assertEvidenceEvent(input); return input; }
export function parseEvidenceEventsJson(json: string): EvidenceEvent[] { const input = parse(json, "EvidenceEvent[]"); assertEvidenceEvents(input); return input; }

export function validateEvidencePolicy(input: unknown): ValidationResult<EvidencePolicy> {
  const issues: ValidationIssue[] = []; const value = object(input, "$", issues);
  if (value) {
    keys(value, ["screenshots", "trace", "video", "sampleFps", "maxScreenshots", "maxBytes", "reviewRequired"], "$", issues);
    enumeration(value.screenshots, ["none", "checkpoints", "events"], "$.screenshots", issues);
    enumeration(value.trace, ["off", "failure", "always"], "$.trace", issues); enumeration(value.video, ["off", "failure", "always"], "$.video", issues);
    finite(value.sampleFps, "$.sampleFps", issues, 0, 60); finite(value.maxScreenshots, "$.maxScreenshots", issues, 0, 10000, true); finite(value.maxBytes, "$.maxBytes", issues, 0, Number.MAX_SAFE_INTEGER, true);
    if (typeof value.reviewRequired !== "boolean") add(issues, "$.reviewRequired", "must be a boolean");
  }
  return result(input, issues);
}
export function assertEvidencePolicy(input: unknown): asserts input is EvidencePolicy { const checked = validateEvidencePolicy(input); if (!checked.valid) throw new ContractValidationError("EvidencePolicy", checked.issues); }
export function parseEvidencePolicyJson(json: string): EvidencePolicy { const input = parse(json, "EvidencePolicy"); assertEvidencePolicy(input); return input; }

function checkEvent(input: unknown, path: string, issues: ValidationIssue[]): void {
  const value = object(input, path, issues); if (!value) return;
  keys(value, ["schemaVersion", "sequence", "timestamp", "trigger", "scenarioStepId", "correlationId", "summary", "imageSha256", "duplicateOfSha256", "details"], path, issues);
  if (value.schemaVersion !== "0.1") add(issues, `${path}.schemaVersion`, "must equal 0.1");
  finite(value.sequence, `${path}.sequence`, issues, 0, Number.MAX_SAFE_INTEGER, true); date(value.timestamp, `${path}.timestamp`, issues); enumeration(value.trigger, triggers, `${path}.trigger`, issues); text(value, "summary", path, issues);
  for (const key of ["scenarioStepId", "correlationId"] as const) if (value[key] !== undefined && (typeof value[key] !== "string" || value[key].length === 0)) add(issues, `${path}.${key}`, "must be a non-empty string when provided");
  if (value.imageSha256 !== undefined) sha256(value.imageSha256, `${path}.imageSha256`, issues); if (value.duplicateOfSha256 !== undefined) sha256(value.duplicateOfSha256, `${path}.duplicateOfSha256`, issues);
  if (value.imageSha256 !== undefined && value.duplicateOfSha256 !== undefined) add(issues, path, "imageSha256 and duplicateOfSha256 are mutually exclusive");
  if (value.details !== undefined && !isRecord(value.details)) add(issues, `${path}.details`, "must be an object when provided");
}
function parse(json: string, contract: string): unknown { try { return parseJson(json, contract); } catch (error) { throw new ContractValidationError(contract, [{ path: "$", message: error instanceof Error ? error.message : String(error) }]); } }
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
