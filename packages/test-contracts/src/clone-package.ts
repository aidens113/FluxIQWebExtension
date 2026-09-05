import { ContractValidationError, type ValidationIssue, type ValidationResult } from "./validation.js";
import { add, array, enumeration, finite, keys, object, parseJson, result, sha256 } from "./runtime-validation.js";

export const CLONE_PACKAGE_SCHEMA_VERSION = "0.1" as const;

export type CloneJsonValue = null | boolean | number | string | CloneJsonValue[] | { [key: string]: CloneJsonValue };
export type CloneJsonObject = { [key: string]: CloneJsonValue };
export type CloneDependencyKind = "domain-node" | "native-node" | "flow-local-reference" | "flow-reference" | "external-side-effect";
export type CloneDependencyDecision = "allow" | "remap" | "test-double" | "reject";
export type CloneDependency = {
  dependencyId: string;
  kind: CloneDependencyKind;
  referenceId: string;
  decision: CloneDependencyDecision;
  replacementId?: string;
  reason: string;
};
export type CloneIdMapping = {
  kind: "project" | "flow" | "node" | "edge" | "local-reference";
  sourceId: string;
  destinationId: string;
};
export type ClonePackage = {
  schemaVersion: typeof CLONE_PACKAGE_SCHEMA_VERSION;
  source: {
    origin: string;
    projectId: string;
    flowId: string;
    contentHash: string;
    updatedAt: number;
  };
  flowDocument: CloneJsonObject;
  dependencies: CloneDependency[];
  compatibility: { verdict: "compatible" | "incompatible"; reasons: string[] };
  idMap: CloneIdMapping[];
};

const forbiddenKey = /^(?:authorization|cookie|cookies|credential|credentials|gateway|identity|password|pin|publicationHistory|recording|recordings|run|runs|runtimeHistory|schedule|schedules|secret|secrets|session|sessions|token|tokens|totp)$/iu;
const secretKeyFragment = /^(?:accessToken|apiKey|authToken|authorization|bearer|cookie|credential|password|privateKey|refreshToken|secret|sessionKey|token|totp)$/iu;
const suspiciousValue = /^(?:Bearer\s+\S+|Basic\s+\S+|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}|(?:gh[pousr]_|sk-(?:live-)?|xox[baprs]-)[A-Za-z0-9_-]{12,})/u;
const flowRootFields = ["schemaVersion", "flowId", "projectId", "name", "description", "scope", "visibility", "origin", "source", "interface", "errors", "variables", "regions", "regionHandoffs", "nodes", "edges", "executionDefaults", "publication", "createdAt", "updatedAt", "metadata"] as const;

export function validateClonePackage(input: unknown): ValidationResult<ClonePackage> {
  const issues: ValidationIssue[] = [];
  const value = object(input, "$", issues);
  if (!value) return result(input, issues);
  keys(value, ["schemaVersion", "source", "flowDocument", "dependencies", "compatibility", "idMap"], "$", issues);
  if (value.schemaVersion !== CLONE_PACKAGE_SCHEMA_VERSION) add(issues, "$.schemaVersion", `must equal ${CLONE_PACKAGE_SCHEMA_VERSION}`);
  validateSource(value.source, issues);
  validateFlowDocument(value.flowDocument, issues);
  array(value.dependencies, "$.dependencies", issues, validateDependency);
  validateCompatibility(value.compatibility, issues);
  array(value.idMap, "$.idMap", issues, validateIdMapping);
  validatePackageConsistency(value, issues);
  return result(input, issues);
}

export function assertClonePackage(input: unknown): asserts input is ClonePackage {
  const checked = validateClonePackage(input);
  if (!checked.valid) throw new ContractValidationError("ClonePackage", checked.issues);
}

export function parseClonePackageJson(json: string): ClonePackage {
  let input: unknown;
  try { input = parseJson(json, "ClonePackage"); }
  catch (error) { throw new ContractValidationError("ClonePackage", [{ path: "$", message: error instanceof Error ? error.message : String(error) }]); }
  assertClonePackage(input);
  return input;
}

/** Canonical serialization used as the only input to clone-package hashing. */
export function canonicalClonePackageJson(value: ClonePackage): string {
  assertClonePackage(value);
  return stableJson(value);
}

/**
 * Produces the only Flow payload allowed inside a clone package. Historical and
 * published state is removed, while secret-bearing input is rejected rather
 * than silently redacted.
 */
export function sanitizeCloneFlowDocument(input: unknown): CloneJsonObject {
  if (!isRecord(input)) throw new ContractValidationError("CloneFlowDocument", [{ path: "$", message: "must be an object" }]);
  const unknown = Object.keys(input).filter(key => !flowRootFields.includes(key as typeof flowRootFields[number]) && !["publicationHistory", "evidenceReferences", "expansion", "legacyProvenance"].includes(key));
  if (unknown.length > 0) throw new ContractValidationError("CloneFlowDocument", unknown.map(key => ({ path: `$.${key}`, message: "unknown property" })));
  const output = structuredClone(input);
  delete output.publicationHistory;
  delete output.evidenceReferences;
  delete output.expansion;
  delete output.legacyProvenance;
  output.publication = { status: "draft" };
  const issues: ValidationIssue[] = [];
  validateFlowDocument(output, issues);
  if (issues.length > 0) throw new ContractValidationError("CloneFlowDocument", issues.map(issue => ({ ...issue, path: issue.path.replace(/^\$\.flowDocument/u, "$") })));
  return output as CloneJsonObject;
}

function validateSource(input: unknown, issues: ValidationIssue[]): void {
  const path = "$.source";
  const value = object(input, path, issues); if (!value) return;
  keys(value, ["origin", "projectId", "flowId", "contentHash", "updatedAt"], path, issues);
  exactOrigin(value.origin, `${path}.origin`, issues);
  boundedText(value.projectId, `${path}.projectId`, issues);
  boundedText(value.flowId, `${path}.flowId`, issues);
  sha256(value.contentHash, `${path}.contentHash`, issues);
  finite(value.updatedAt, `${path}.updatedAt`, issues, 0, Number.MAX_SAFE_INTEGER, true);
}

function validateFlowDocument(input: unknown, issues: ValidationIssue[]): void {
  const path = "$.flowDocument";
  const value = object(input, path, issues); if (!value) return;
  keys(value, flowRootFields, path, issues);
  for (const key of ["schemaVersion", "flowId", "projectId", "name"] as const) boundedText(value[key], `${path}.${key}`, issues);
  if (!Array.isArray(value.nodes)) add(issues, `${path}.nodes`, "must be an array");
  if (!Array.isArray(value.edges)) add(issues, `${path}.edges`, "must be an array");
  const publication = object(value.publication, `${path}.publication`, issues);
  if (publication) {
    keys(publication, ["status"], `${path}.publication`, issues);
    if (publication.status !== "draft") add(issues, `${path}.publication.status`, "must be draft; source publication state is never cloned");
  }
  validateSafeJson(value, path, issues, 0);
}

function validateDependency(input: unknown, path: string, issues: ValidationIssue[]): void {
  const value = object(input, path, issues); if (!value) return;
  keys(value, ["dependencyId", "kind", "referenceId", "decision", "replacementId", "reason"], path, issues);
  boundedText(value.dependencyId, `${path}.dependencyId`, issues);
  enumeration(value.kind, ["domain-node", "native-node", "flow-local-reference", "flow-reference", "external-side-effect"], `${path}.kind`, issues);
  boundedText(value.referenceId, `${path}.referenceId`, issues);
  enumeration(value.decision, ["allow", "remap", "test-double", "reject"], `${path}.decision`, issues);
  boundedText(value.reason, `${path}.reason`, issues, 512);
  if (value.replacementId !== undefined) boundedText(value.replacementId, `${path}.replacementId`, issues);
  if (value.decision === "test-double" && value.replacementId === undefined) add(issues, `${path}.replacementId`, "is required for a test-double decision");
  if (value.decision !== "test-double" && value.replacementId !== undefined) add(issues, `${path}.replacementId`, "is allowed only for a test-double decision");
  if (value.kind === "external-side-effect" && value.decision !== "test-double" && value.decision !== "reject") add(issues, `${path}.decision`, "external side effects must be replaced by a named test double or rejected");
}

function validateCompatibility(input: unknown, issues: ValidationIssue[]): void {
  const path = "$.compatibility";
  const value = object(input, path, issues); if (!value) return;
  keys(value, ["verdict", "reasons"], path, issues);
  enumeration(value.verdict, ["compatible", "incompatible"], `${path}.verdict`, issues);
  array(value.reasons, `${path}.reasons`, issues, (entry, at, target) => boundedText(entry, at, target, 512));
}

function validateIdMapping(input: unknown, path: string, issues: ValidationIssue[]): void {
  const value = object(input, path, issues); if (!value) return;
  keys(value, ["kind", "sourceId", "destinationId"], path, issues);
  enumeration(value.kind, ["project", "flow", "node", "edge", "local-reference"], `${path}.kind`, issues);
  boundedText(value.sourceId, `${path}.sourceId`, issues);
  boundedText(value.destinationId, `${path}.destinationId`, issues);
  if (value.sourceId === value.destinationId) add(issues, `${path}.destinationId`, "must differ from the source ID");
}

function validatePackageConsistency(value: Record<string, unknown>, issues: ValidationIssue[]): void {
  const source = value.source && typeof value.source === "object" && !Array.isArray(value.source) ? value.source as Record<string, unknown> : undefined;
  const flow = value.flowDocument && typeof value.flowDocument === "object" && !Array.isArray(value.flowDocument) ? value.flowDocument as Record<string, unknown> : undefined;
  if (source && flow) {
    if (source.projectId !== flow.projectId) add(issues, "$.flowDocument.projectId", "must equal source.projectId");
    if (source.flowId !== flow.flowId) add(issues, "$.flowDocument.flowId", "must equal source.flowId");
  }
  const dependencies = Array.isArray(value.dependencies) ? value.dependencies.filter(isRecord) : [];
  const ids = dependencies.map(item => item.dependencyId).filter((item): item is string => typeof item === "string");
  if (new Set(ids).size !== ids.length) add(issues, "$.dependencies", "dependency IDs must be unique");
  const rejected = dependencies.some(item => item.decision === "reject");
  const compatibility = isRecord(value.compatibility) ? value.compatibility : undefined;
  if (compatibility?.verdict === "compatible" && rejected) add(issues, "$.compatibility.verdict", "cannot be compatible while a dependency is rejected");
  if (compatibility?.verdict === "incompatible" && !rejected) add(issues, "$.compatibility.verdict", "requires at least one rejected dependency");
  if (compatibility?.verdict === "compatible" && Array.isArray(compatibility.reasons) && compatibility.reasons.length !== 0) add(issues, "$.compatibility.reasons", "must be empty for a compatible package");
  if (compatibility?.verdict === "incompatible" && Array.isArray(compatibility.reasons) && compatibility.reasons.length === 0) add(issues, "$.compatibility.reasons", "must describe why the package is incompatible");
  const mappings = Array.isArray(value.idMap) ? value.idMap.filter(isRecord) : [];
  const sourceKeys = mappings.map(item => `${String(item.kind)}:${String(item.sourceId)}`);
  const destinationKeys = mappings.map(item => `${String(item.kind)}:${String(item.destinationId)}`);
  if (new Set(sourceKeys).size !== sourceKeys.length) add(issues, "$.idMap", "source mappings must be unique by kind and ID");
  if (new Set(destinationKeys).size !== destinationKeys.length) add(issues, "$.idMap", "destination mappings must be unique by kind and ID");
  if (source && flow) {
    requireIdentityMapping(mappings, "project", source.projectId, "$.source.projectId", issues);
    requireIdentityMapping(mappings, "flow", source.flowId, "$.source.flowId", issues);
    requireDocumentMappings(mappings, flow.nodes, "node", "$.flowDocument.nodes", issues);
    requireDocumentMappings(mappings, flow.edges, "edge", "$.flowDocument.edges", issues);
  }
}

function requireIdentityMapping(mappings: Record<string, unknown>[], kind: string, sourceId: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof sourceId !== "string") return;
  if (mappings.filter(item => item.kind === kind && item.sourceId === sourceId).length !== 1) add(issues, "$.idMap", `must contain exactly one ${kind} mapping for ${path}`);
}

function requireDocumentMappings(mappings: Record<string, unknown>[], entries: unknown, kind: "node" | "edge", path: string, issues: ValidationIssue[]): void {
  if (!Array.isArray(entries)) return;
  entries.forEach((entry, index) => {
    if (!isRecord(entry) || typeof entry.id !== "string") return;
    if (mappings.filter(item => item.kind === kind && item.sourceId === entry.id).length !== 1) add(issues, "$.idMap", `must contain exactly one ${kind} mapping for ${path}[${index}].id`);
  });
}

function validateSafeJson(value: unknown, path: string, issues: ValidationIssue[], depth: number): void {
  if (depth > 48) { add(issues, path, "exceeds the maximum clone document depth"); return; }
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number") { if (!Number.isFinite(value)) add(issues, path, "must be finite JSON data"); return; }
  if (typeof value === "string") { if (suspiciousValue.test(value)) add(issues, path, "contains an opaque secret-looking value"); return; }
  if (Array.isArray(value)) { value.forEach((entry, index) => validateSafeJson(entry, `${path}[${index}]`, issues, depth + 1)); return; }
  if (!isRecord(value)) { add(issues, path, "must contain JSON data only"); return; }
  for (const [key, entry] of Object.entries(value)) {
    const child = `${path}.${key}`;
    if (forbiddenKey.test(key) || secretKeyFragment.test(key)) { add(issues, child, "forbidden secret, identity, publication, runtime, recording, schedule, or gateway field"); continue; }
    validateSafeJson(entry, child, issues, depth + 1);
  }
}

function exactOrigin(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof input !== "string") { add(issues, path, "must be an exact credential-free HTTP(S) origin"); return; }
  try {
    const url = new URL(input);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password || input !== url.origin) add(issues, path, "must be an exact credential-free HTTP(S) origin");
  } catch { add(issues, path, "must be an exact credential-free HTTP(S) origin"); }
}

function boundedText(input: unknown, path: string, issues: ValidationIssue[], maximum = 256): void {
  if (typeof input !== "string" || input.length === 0 || input.length > maximum || input.trim() !== input) add(issues, path, `must be trimmed non-empty text of at most ${maximum} characters`);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`;
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
