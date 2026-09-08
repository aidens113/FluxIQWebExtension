import { scenarioCapabilities, type WebScenario } from "./scenario.js";

export type ValidationIssue = { path: string; message: string };
export type ValidationResult<T> = { valid: true; value: T } | { valid: false; issues: ValidationIssue[] };

export class ContractValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(contract: string, issues: ValidationIssue[]) {
    super(`${contract} validation failed:\n${issues.map((issue) => `- ${issue.path}: ${issue.message}`).join("\n")}`);
    this.name = "ContractValidationError";
    this.issues = issues;
  }
}

type JsonObject = Record<string, unknown>;
type Validator = (value: unknown, path: string, issues: ValidationIssue[]) => void;
const operations = ["click", "type", "select", "scroll", "navigate", "waitForState", "checkpoint"] as const;

const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);
const issue = (issues: ValidationIssue[], path: string, message: string) => issues.push({ path, message });
const checkKeys = (value: JsonObject, allowed: readonly string[], path: string, issues: ValidationIssue[]) => {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) issue(issues, `${path}.${key}`, "unknown property");
};
const requiredString = (value: JsonObject, key: string, path: string, issues: ValidationIssue[]) => {
  if (typeof value[key] !== "string" || value[key].length === 0) issue(issues, `${path}.${key}`, "must be a non-empty string");
};
const optionalString = (value: JsonObject, key: string, path: string, issues: ValidationIssue[]) => {
  if (value[key] !== undefined && (typeof value[key] !== "string" || value[key].length === 0)) issue(issues, `${path}.${key}`, "must be a non-empty string when provided");
};
const arrayOf = (value: unknown, path: string, issues: ValidationIssue[], validator: Validator) => {
  if (!Array.isArray(value)) return issue(issues, path, "must be an array");
  value.forEach((entry, index) => validator(entry, `${path}[${index}]`, issues));
};

const validateFact: Validator = (value, path, issues) => {
  if (!isObject(value)) return issue(issues, path, "must be an object");
  checkKeys(value, ["id", "subject", "predicate", "value"], path, issues);
  requiredString(value, "id", path, issues);
  requiredString(value, "subject", path, issues);
  requiredString(value, "predicate", path, issues);
  if (!("value" in value)) issue(issues, `${path}.value`, "is required");
};

const validateStep: Validator = (value, path, issues) => {
  if (!isObject(value)) return issue(issues, path, "must be an object");
  checkKeys(value, ["id", "operation", "target", "value", "path", "timeoutMs"], path, issues);
  requiredString(value, "id", path, issues);
  if (!operations.includes(value.operation as never)) issue(issues, `${path}.operation`, "has an unsupported value");
  optionalString(value, "target", path, issues);
  optionalString(value, "path", path, issues);
  if (typeof value.path === "string" && !value.path.startsWith("/")) issue(issues, `${path}.path`, "must start with /");
  if (value.value !== undefined && !["string", "number", "boolean"].includes(typeof value.value)) issue(issues, `${path}.value`, "must be a string, number, or boolean");
  if (value.timeoutMs !== undefined && (!Number.isInteger(value.timeoutMs) || Number(value.timeoutMs) < 0)) issue(issues, `${path}.timeoutMs`, "must be a non-negative integer");
  if (["click", "type", "select", "waitForState"].includes(String(value.operation)) && value.target === undefined) issue(issues, `${path}.target`, `is required for ${String(value.operation)}`);
  if (value.operation === "navigate" && value.path === undefined) issue(issues, `${path}.path`, "is required for navigate");
  if (["type", "select", "scroll"].includes(String(value.operation)) && value.value === undefined) issue(issues, `${path}.value`, `is required for ${String(value.operation)}`);
};

const validateGoal: Validator = (value, path, issues) => {
  if (!isObject(value)) return issue(issues, path, "must be an object");
  checkKeys(value, ["id", "description", "successFacts"], path, issues);
  requiredString(value, "id", path, issues);
  requiredString(value, "description", path, issues);
  arrayOf(value.successFacts, `${path}.successFacts`, issues, validateFact);
};

const validateExpected: Validator = (value, path, issues) => {
  if (!isObject(value)) return issue(issues, path, "must be an object");
  checkKeys(value, ["pageFacts", "recordingEvents", "actions", "finalState", "allowedConsoleErrors"], path, issues);
  if (value.pageFacts !== undefined) arrayOf(value.pageFacts, `${path}.pageFacts`, issues, validateFact);
  if (value.finalState !== undefined) arrayOf(value.finalState, `${path}.finalState`, issues, validateFact);
  if (value.recordingEvents !== undefined) arrayOf(value.recordingEvents, `${path}.recordingEvents`, issues, (event, eventPath, target) => {
    if (!isObject(event)) return issue(target, eventPath, "must be an object");
    checkKeys(event, ["type", "count"], eventPath, target);
    requiredString(event, "type", eventPath, target);
    if (event.count !== undefined && (!Number.isInteger(event.count) || Number(event.count) < 0)) issue(target, `${eventPath}.count`, "must be a non-negative integer");
  });
  if (value.actions !== undefined) arrayOf(value.actions, `${path}.actions`, issues, (action, actionPath, target) => {
    if (!isObject(action)) return issue(target, actionPath, "must be an object");
    checkKeys(action, ["action", "outcome"], actionPath, target);
    requiredString(action, "action", actionPath, target);
    if (action.outcome !== undefined && !["succeeded", "failed", "rejected"].includes(String(action.outcome))) issue(target, `${actionPath}.outcome`, "has an unsupported value");
  });
  if (value.allowedConsoleErrors !== undefined) arrayOf(value.allowedConsoleErrors, `${path}.allowedConsoleErrors`, issues, (entry, entryPath, target) => {
    if (typeof entry !== "string") issue(target, entryPath, "must be a string");
  });
};

const validateEvidencePolicy: Validator = (value, path, issues) => {
  if (!isObject(value)) return issue(issues, path, "must be an object");
  checkKeys(value, ["screenshots", "trace", "video", "sampleFps", "reviewRequired"], path, issues);
  if (value.screenshots !== undefined && !["none", "checkpoints", "events"].includes(String(value.screenshots))) issue(issues, `${path}.screenshots`, "has an unsupported value");
  for (const key of ["trace", "video"] as const) if (value[key] !== undefined && !["off", "failure", "always"].includes(String(value[key]))) issue(issues, `${path}.${key}`, "has an unsupported value");
  if (value.sampleFps !== undefined && (typeof value.sampleFps !== "number" || !Number.isFinite(value.sampleFps) || value.sampleFps < 0 || value.sampleFps > 1)) issue(issues, `${path}.sampleFps`, "must be between 0 and 1");
  if (value.reviewRequired !== undefined && typeof value.reviewRequired !== "boolean") issue(issues, `${path}.reviewRequired`, "must be a boolean");
};

export function validateWebScenario(input: unknown): ValidationResult<WebScenario> {
  const issues: ValidationIssue[] = [];
  if (!isObject(input)) return { valid: false, issues: [{ path: "$", message: "must be an object" }] };
  checkKeys(input, ["schemaVersion", "id", "title", "tags", "seed", "startPath", "capabilities", "networkPolicy", "recordingScript", "playbackGoal", "expected", "evidencePolicy"], "$", issues);
  if (input.schemaVersion !== "0.1") issue(issues, "$.schemaVersion", "must equal 0.1");
  requiredString(input, "id", "$", issues);
  if (typeof input.id === "string" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.id)) issue(issues, "$.id", "must be a kebab-case identifier");
  requiredString(input, "title", "$", issues);
  arrayOf(input.tags, "$.tags", issues, (tag, path, target) => { if (typeof tag !== "string" || tag.length === 0) issue(target, path, "must be a non-empty string"); });
  if (Array.isArray(input.tags) && new Set(input.tags).size !== input.tags.length) issue(issues, "$.tags", "must contain unique values");
  if (!Number.isInteger(input.seed) || Number(input.seed) < 0 || Number(input.seed) > 0xffffffff) issue(issues, "$.seed", "must be an unsigned 32-bit integer");
  requiredString(input, "startPath", "$", issues);
  if (typeof input.startPath === "string" && !input.startPath.startsWith("/")) issue(issues, "$.startPath", "must start with /");
  arrayOf(input.capabilities, "$.capabilities", issues, (capability, path, target) => { if (!scenarioCapabilities.includes(capability as never)) issue(target, path, "is not a supported capability"); });
  if (Array.isArray(input.capabilities) && new Set(input.capabilities).size !== input.capabilities.length) issue(issues, "$.capabilities", "must contain unique values");
  if (!["loopback-only", "allowlisted-real-site"].includes(String(input.networkPolicy))) issue(issues, "$.networkPolicy", "has an unsupported value");
  arrayOf(input.recordingScript, "$.recordingScript", issues, validateStep);
  if (Array.isArray(input.recordingScript) && input.recordingScript.length === 0 && input.playbackGoal === undefined) issue(issues, "$.recordingScript", "may be empty only when playbackGoal is defined");
  if (Array.isArray(input.recordingScript)) {
    const ids = input.recordingScript.filter(isObject).map((step) => step.id);
    if (new Set(ids).size !== ids.length) issue(issues, "$.recordingScript", "step ids must be unique");
  }
  validateExpected(input.expected, "$.expected", issues);
  if (input.playbackGoal !== undefined) validateGoal(input.playbackGoal, "$.playbackGoal", issues);
  if (input.evidencePolicy !== undefined) validateEvidencePolicy(input.evidencePolicy, "$.evidencePolicy", issues);
  return issues.length === 0 ? { valid: true, value: input as WebScenario } : { valid: false, issues };
}

export function assertWebScenario(input: unknown): asserts input is WebScenario {
  const result = validateWebScenario(input);
  if (!result.valid) throw new ContractValidationError("WebScenario", result.issues);
}

export function parseWebScenarioJson(json: string): WebScenario {
  let input: unknown;
  try {
    input = JSON.parse(json);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ContractValidationError("WebScenario", [{ path: "$", message: `invalid JSON: ${detail}` }]);
  }
  assertWebScenario(input);
  return input;
}
