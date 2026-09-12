import { isAutomationStudioAdaptiveFailureClass } from "./failure-category.js";
import { SCENARIO_EXTRACT_MAX_PAGES, scenarioCapabilities, scenarioStepOperations, type WebScenario } from "./scenario.js";

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

const KEBAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TARGET_REQUIRED = ["click", "type", "select", "waitForState", "check", "upload", "extract"];
const PATH_REQUIRED = ["navigate", "switchTab"];
const VALUE_REQUIRED = ["type", "select", "scroll", "press", "check", "upload", "waitForDownload"];
const STRING_VALUE = ["press", "upload", "waitForDownload"];

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
const kebabId = (value: JsonObject, path: string, issues: ValidationIssue[]) => {
  requiredString(value, "id", path, issues);
  if (typeof value.id === "string" && !KEBAB_ID.test(value.id)) issue(issues, `${path}.id`, "must be a kebab-case identifier");
};
const arrayOf = (value: unknown, path: string, issues: ValidationIssue[], validator: Validator) => {
  if (!Array.isArray(value)) return issue(issues, path, "must be an array");
  value.forEach((entry, index) => validator(entry, `${path}[${index}]`, issues));
};
const uniqueIds = (value: unknown, path: string, label: string, issues: ValidationIssue[]) => {
  if (!Array.isArray(value)) return;
  const ids = value.filter(isObject).map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) issue(issues, path, `${label} ids must be unique`);
};

const validateFact: Validator = (value, path, issues) => {
  if (!isObject(value)) return issue(issues, path, "must be an object");
  checkKeys(value, ["id", "subject", "predicate", "value"], path, issues);
  requiredString(value, "id", path, issues);
  requiredString(value, "subject", path, issues);
  requiredString(value, "predicate", path, issues);
  if (!("value" in value)) issue(issues, `${path}.value`, "is required");
};

const validateExtractShape = (value: JsonObject, path: string, issues: ValidationIssue[]) => {
  if (!isObject(value.fields) || Object.keys(value.fields).length === 0) issue(issues, `${path}.fields`, "must be a non-empty object for extract");
  else for (const [name, selector] of Object.entries(value.fields)) {
    if (typeof selector !== "string" || selector.length === 0) issue(issues, `${path}.fields.${name}`, "must be a non-empty selector string");
  }
  if (value.pagination === undefined) return;
  const paginationPath = `${path}.pagination`;
  if (!isObject(value.pagination)) return issue(issues, paginationPath, "must be an object");
  checkKeys(value.pagination, ["next", "maxPages"], paginationPath, issues);
  requiredString(value.pagination, "next", paginationPath, issues);
  const maxPages = value.pagination.maxPages;
  if (!Number.isInteger(maxPages) || Number(maxPages) < 1 || Number(maxPages) > SCENARIO_EXTRACT_MAX_PAGES) {
    issue(issues, `${paginationPath}.maxPages`, `must be an integer from 1 to ${SCENARIO_EXTRACT_MAX_PAGES}`);
  }
};

const validateStep: Validator = (value, path, issues) => {
  if (!isObject(value)) return issue(issues, path, "must be an object");
  checkKeys(value, ["id", "operation", "target", "value", "path", "timeoutMs", "fields", "pagination"], path, issues);
  requiredString(value, "id", path, issues);
  const operation = String(value.operation);
  if (!scenarioStepOperations.includes(value.operation as never)) issue(issues, `${path}.operation`, "has an unsupported value");
  optionalString(value, "target", path, issues);
  optionalString(value, "path", path, issues);
  if (typeof value.path === "string" && !value.path.startsWith("/")) issue(issues, `${path}.path`, "must start with /");
  if (value.value !== undefined && !["string", "number", "boolean"].includes(typeof value.value)) issue(issues, `${path}.value`, "must be a string, number, or boolean");
  if (value.timeoutMs !== undefined && (!Number.isInteger(value.timeoutMs) || Number(value.timeoutMs) < 0)) issue(issues, `${path}.timeoutMs`, "must be a non-negative integer");
  if (TARGET_REQUIRED.includes(operation) && value.target === undefined) issue(issues, `${path}.target`, `is required for ${operation}`);
  if (PATH_REQUIRED.includes(operation) && value.path === undefined) issue(issues, `${path}.path`, `is required for ${operation}`);
  if (VALUE_REQUIRED.includes(operation) && value.value === undefined) issue(issues, `${path}.value`, `is required for ${operation}`);
  if (operation === "check" && value.value !== undefined && typeof value.value !== "boolean") issue(issues, `${path}.value`, "must be a boolean for check");
  if (STRING_VALUE.includes(operation) && value.value !== undefined && (typeof value.value !== "string" || value.value.length === 0)) {
    issue(issues, `${path}.value`, `must be a non-empty string for ${operation}`);
  }
  if (operation === "extract") validateExtractShape(value, path, issues);
  else for (const key of ["fields", "pagination"]) if (value[key] !== undefined) issue(issues, `${path}.${key}`, "is allowed only for extract");
};

const validateGoal: Validator = (value, path, issues) => {
  if (!isObject(value)) return issue(issues, path, "must be an object");
  checkKeys(value, ["id", "description", "successFacts"], path, issues);
  requiredString(value, "id", path, issues);
  requiredString(value, "description", path, issues);
  arrayOf(value.successFacts, `${path}.successFacts`, issues, validateFact);
};

const validateExtraction: Validator = (value, path, issues) => {
  if (!isObject(value)) return issue(issues, path, "must be an object");
  checkKeys(value, ["step", "count", "records"], path, issues);
  requiredString(value, "step", path, issues);
  if (value.count === undefined && value.records === undefined) issue(issues, path, "needs count or records");
  if (value.count !== undefined && (!Number.isInteger(value.count) || Number(value.count) < 0)) issue(issues, `${path}.count`, "must be a non-negative integer");
  if (value.records !== undefined) arrayOf(value.records, `${path}.records`, issues, (record, recordPath, target) => {
    if (!isObject(record)) return issue(target, recordPath, "must be an object");
    for (const [field, text] of Object.entries(record)) if (typeof text !== "string") issue(target, `${recordPath}.${field}`, "must be a string");
  });
};

const validateFailure: Validator = (value, path, issues) => {
  if (!isObject(value)) return issue(issues, path, "must be an object");
  checkKeys(value, ["category", "code"], path, issues);
  if (!isAutomationStudioAdaptiveFailureClass(value.category)) issue(issues, `${path}.category`, "is not a known failure category");
  optionalString(value, "code", path, issues);
};

const validateExpected: Validator = (value, path, issues) => {
  if (!isObject(value)) return issue(issues, path, "must be an object");
  checkKeys(value, ["pageFacts", "recordingEvents", "actions", "finalState", "allowedConsoleErrors", "extracted", "failure"], path, issues);
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
  if (value.extracted !== undefined) arrayOf(value.extracted, `${path}.extracted`, issues, validateExtraction);
  if (value.failure !== undefined) validateFailure(value.failure, `${path}.failure`, issues);
};

const validateVariant: Validator = (value, path, issues) => {
  if (!isObject(value)) return issue(issues, path, "must be an object");
  checkKeys(value, ["id", "description", "arm", "expected"], path, issues);
  kebabId(value, path, issues);
  requiredString(value, "description", path, issues);
  if (!isObject(value.arm)) issue(issues, `${path}.arm`, "must be an object");
  else {
    checkKeys(value.arm, ["operation", "payload"], `${path}.arm`, issues);
    requiredString(value.arm, "operation", `${path}.arm`, issues);
  }
  validateExpected(value.expected, `${path}.expected`, issues);
};

/** Every `extracted[].step`, in a workflow's expectations and in each of its variants, must name one of its extract steps. */
const checkExtractionReferences = (workflow: JsonObject, path: string, issues: ValidationIssue[]) => {
  const script = Array.isArray(workflow.recordingScript) ? workflow.recordingScript.filter(isObject) : [];
  const extractIds = new Set(script.filter((step) => step.operation === "extract").map((step) => step.id));
  const check = (expected: unknown, expectedPath: string) => {
    if (!isObject(expected) || !Array.isArray(expected.extracted)) return;
    expected.extracted.forEach((entry, index) => {
      if (isObject(entry) && typeof entry.step === "string" && !extractIds.has(entry.step)) issue(issues, `${expectedPath}.extracted[${index}].step`, "must name an extract step in this workflow's recordingScript");
    });
  };
  check(workflow.expected, `${path}.expected`);
  if (Array.isArray(workflow.variants)) workflow.variants.forEach((variant, index) => { if (isObject(variant)) check(variant.expected, `${path}.variants[${index}].expected`); });
};

/** Script, expectations, variants, and extraction references shared by the primary workflow and each `workflows[]` entry. */
const validateWorkflowBody = (workflow: JsonObject, path: string, issues: ValidationIssue[]) => {
  arrayOf(workflow.recordingScript, `${path}.recordingScript`, issues, validateStep);
  uniqueIds(workflow.recordingScript, `${path}.recordingScript`, "step", issues);
  validateExpected(workflow.expected, `${path}.expected`, issues);
  if (workflow.variants !== undefined) {
    arrayOf(workflow.variants, `${path}.variants`, issues, validateVariant);
    uniqueIds(workflow.variants, `${path}.variants`, "variant", issues);
  }
  checkExtractionReferences(workflow, path, issues);
};

const validateWorkflow: Validator = (value, path, issues) => {
  if (!isObject(value)) return issue(issues, path, "must be an object");
  checkKeys(value, ["id", "description", "recordingScript", "expected", "variants"], path, issues);
  kebabId(value, path, issues);
  requiredString(value, "description", path, issues);
  if (Array.isArray(value.recordingScript) && value.recordingScript.length === 0) issue(issues, `${path}.recordingScript`, "must contain at least one step");
  validateWorkflowBody(value, path, issues);
};

/** A replay secret declaration: a kebab-case id and the recording step whose recorded value it replaces. */
const validateSecret: Validator = (value, path, issues) => {
  if (!isObject(value)) return issue(issues, path, "must be an object");
  checkKeys(value, ["id", "step"], path, issues);
  kebabId(value, path, issues);
  requiredString(value, "step", path, issues);
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
  checkKeys(input, ["schemaVersion", "id", "title", "tags", "seed", "startPath", "capabilities", "networkPolicy", "recordingScript", "playbackGoal", "expected", "variants", "workflows", "secrets", "evidencePolicy"], "$", issues);
  if (input.schemaVersion !== "0.1") issue(issues, "$.schemaVersion", "must equal 0.1");
  kebabId(input, "$", issues);
  requiredString(input, "title", "$", issues);
  arrayOf(input.tags, "$.tags", issues, (tag, path, target) => { if (typeof tag !== "string" || tag.length === 0) issue(target, path, "must be a non-empty string"); });
  if (Array.isArray(input.tags) && new Set(input.tags).size !== input.tags.length) issue(issues, "$.tags", "must contain unique values");
  if (!Number.isInteger(input.seed) || Number(input.seed) < 0 || Number(input.seed) > 0xffffffff) issue(issues, "$.seed", "must be an unsigned 32-bit integer");
  requiredString(input, "startPath", "$", issues);
  if (typeof input.startPath === "string" && !input.startPath.startsWith("/")) issue(issues, "$.startPath", "must start with /");
  arrayOf(input.capabilities, "$.capabilities", issues, (capability, path, target) => { if (!scenarioCapabilities.includes(capability as never)) issue(target, path, "is not a supported capability"); });
  if (Array.isArray(input.capabilities) && new Set(input.capabilities).size !== input.capabilities.length) issue(issues, "$.capabilities", "must contain unique values");
  if (!["loopback-only", "allowlisted-real-site"].includes(String(input.networkPolicy))) issue(issues, "$.networkPolicy", "has an unsupported value");
  validateWorkflowBody(input, "$", issues);
  if (Array.isArray(input.recordingScript) && input.recordingScript.length === 0 && input.playbackGoal === undefined) issue(issues, "$.recordingScript", "may be empty only when playbackGoal is defined");
  if (input.workflows !== undefined) {
    arrayOf(input.workflows, "$.workflows", issues, validateWorkflow);
    uniqueIds(input.workflows, "$.workflows", "workflow", issues);
  }
  if (input.secrets !== undefined) {
    arrayOf(input.secrets, "$.secrets", issues, validateSecret);
    uniqueIds(input.secrets, "$.secrets", "secret", issues);
  }
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
