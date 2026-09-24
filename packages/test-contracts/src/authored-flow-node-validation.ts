import { AUTHORED_FLOW_NODE_BOUNDS, AUTHORED_FLOW_NODE_UNRECOGNIZED_OUTPUT, type AuthoredFlowNode } from "./authored-flow-node.js";
import { isCoreIdentifier } from "./harness-recovery-validation.js";
import { add, array, isObject, keys, object, result, uniqueStrings, type JsonObject } from "./runtime-validation.js";
import { ContractValidationError, type ValidationIssue, type ValidationResult } from "./validation.js";

const nodeKeys = ["nodeId", "definitionId", "outputId", "parameters", "parametersWithheld"] as const satisfies readonly (keyof AuthoredFlowNode)[];

/** A domain output name, such as `web.dom.extract_list`; the same shape the producer recognizes. */
const OUTPUT_ID = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){1,4}$/u;
const OUTPUT_ID_MAX_LENGTH = 64;
/**
 * The origin of an absolute http(s) URL and nothing after it. The screen
 * carries a navigation parameter as its origin, because where a step went is
 * answered by the origin and the path and query are where an order number, a
 * search term and a session token live. This is the check that the screen
 * really did stop at the origin.
 */
const ORIGIN = /^https?:\/\/[A-Za-z0-9._~-]+(?::\d{1,5})?$/u;
const ORIGIN_MAX_LENGTH = 255;
/** A dotted path as the screen notes one: `pagination.mode`, `where[2].field`. No space, so it can carry no sentence. */
const WITHHELD_PATH = /^[A-Za-z0-9_$-]+(?:\[\d+\]|\.[A-Za-z0-9_$-]+)*$/u;
const WITHHELD_PATH_MAX_LENGTH = 128;

/**
 * Validates the `authoredNodes` list a created-Flow run's
 * `snapshots/flow-lane.json` carries: one entry per action node of the Flow
 * the build authored.
 *
 * `deniedKeys` is the bound domain's declaration, required rather than
 * optional for the same reason Core's parameter screen requires it: an absent
 * declaration means nobody said what this medium's raw payload is called, never
 * "deny nothing", and a projection of a node's parameters is exactly where that
 * would matter. Declare `[]` to deny nothing, deliberately.
 *
 * Every string is checked against a shape that cannot hold a page: a Core
 * identifier, a closed output name, an origin, or text inside the screen's
 * length bound. Every container is checked against the screen's own depth, key
 * and item bounds, so a screen that stopped bounding what it walks fails here
 * rather than writing a page's worth of parameters into a bundle.
 */
export function validateAuthoredFlowNodes(input: unknown, deniedKeys: readonly string[]): ValidationResult<AuthoredFlowNode[]> {
  const issues: ValidationIssue[] = [];
  const denied = new Set(deniedKeys.map(normalizedKey));
  array(input, "$", issues, (entry, path) => checkNode(entry, path, issues, denied));
  if (Array.isArray(input)) {
    const ids = input.filter(isObject).map((entry) => entry.nodeId);
    uniqueStrings(ids, "$", issues, "node ids");
  }
  return result(input, issues);
}

export function assertAuthoredFlowNodes(input: unknown, deniedKeys: readonly string[]): asserts input is AuthoredFlowNode[] {
  const checked = validateAuthoredFlowNodes(input, deniedKeys);
  if (!checked.valid) throw new ContractValidationError("AuthoredFlowNode[]", checked.issues);
}

/** Core's own spelling rule for comparing a key against a declaration: `_` and `-` removed, lowercased. */
function normalizedKey(key: string): string {
  return key.replace(/[_-]/gu, "").toLowerCase();
}

function checkNode(input: unknown, path: string, issues: ValidationIssue[], denied: ReadonlySet<string>): void {
  const value = object(input, path, issues);
  if (!value) return;
  keys(value, nodeKeys, path, issues);
  if (!isCoreIdentifier(value.nodeId)) add(issues, `${path}.nodeId`, "must be a Core identifier");
  if (value.definitionId !== null && !isCoreIdentifier(value.definitionId)) add(issues, `${path}.definitionId`, "must be a Core identifier or null");
  checkOutputId(value.outputId, `${path}.outputId`, issues);
  const parameters = object(value.parameters, `${path}.parameters`, issues);
  if (parameters) checkScreenedObject(parameters, `${path}.parameters`, issues, denied, 0);
  checkWithheld(value.parametersWithheld, `${path}.parametersWithheld`, issues);
}

function checkOutputId(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (input === AUTHORED_FLOW_NODE_UNRECOGNIZED_OUTPUT) return;
  if (typeof input !== "string" || input.length > OUTPUT_ID_MAX_LENGTH || !OUTPUT_ID.test(input)) {
    add(issues, path, `must be a domain output name of at most ${OUTPUT_ID_MAX_LENGTH} characters, or ${AUTHORED_FLOW_NODE_UNRECOGNIZED_OUTPUT}`);
  }
}

function checkWithheld(input: unknown, path: string, issues: ValidationIssue[]): void {
  array(input, path, issues, (entry, entryPath) => {
    if (typeof entry !== "string" || entry.length > WITHHELD_PATH_MAX_LENGTH || !WITHHELD_PATH.test(entry)) {
      add(issues, entryPath, "must be a dotted parameter path, never the value that was withheld");
    }
  });
  if (!Array.isArray(input)) return;
  uniqueStrings(input, path, issues, "withheld paths");
  if (input.length > AUTHORED_FLOW_NODE_BOUNDS.withheldPaths) add(issues, path, `must hold at most ${AUTHORED_FLOW_NODE_BOUNDS.withheldPaths} paths`);
}

/**
 * One screened object: bounded keys, no key the domain denies, and every value
 * screened in turn. A denied key reaching here is not a near miss -- it is the
 * medium's own word for its raw payload, so its value is the page.
 */
function checkScreenedObject(value: JsonObject, path: string, issues: ValidationIssue[], denied: ReadonlySet<string>, depth: number): void {
  const entries = Object.entries(value);
  if (entries.length > AUTHORED_FLOW_NODE_BOUNDS.keysPerObject) add(issues, path, `must hold at most ${AUTHORED_FLOW_NODE_BOUNDS.keysPerObject} keys`);
  for (const [key, entry] of entries) {
    const at = `${path}.${key}`;
    if (denied.has(normalizedKey(key))) add(issues, at, "must not carry a key the domain denies");
    checkScreenedValue(entry, at, issues, denied, depth);
  }
}

function checkScreenedValue(value: unknown, path: string, issues: ValidationIssue[], denied: ReadonlySet<string>, depth: number): void {
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) add(issues, path, "must be a finite number");
    return;
  }
  if (typeof value === "string") { checkScreenedText(value, path, issues); return; }
  if (depth >= AUTHORED_FLOW_NODE_BOUNDS.depth) { add(issues, path, `must not nest past ${AUTHORED_FLOW_NODE_BOUNDS.depth} levels`); return; }
  if (Array.isArray(value)) {
    if (value.length > AUTHORED_FLOW_NODE_BOUNDS.itemsPerArray) add(issues, path, `must hold at most ${AUTHORED_FLOW_NODE_BOUNDS.itemsPerArray} items`);
    value.forEach((item, index) => checkScreenedValue(item, `${path}[${index}]`, issues, denied, depth + 1));
    return;
  }
  if (!isObject(value)) { add(issues, path, "must be a JSON value the screen produced"); return; }
  checkScreenedObject(value, path, issues, denied, depth + 1);
}

/**
 * A carried string is an origin or it is short. The length bound is what stops
 * a screen that lost its key rule from emitting a paragraph of page text under
 * an innocent-looking key.
 */
function checkScreenedText(value: string, path: string, issues: ValidationIssue[]): void {
  if (ORIGIN.test(value) && value.length <= ORIGIN_MAX_LENGTH) return;
  if (value.length > AUTHORED_FLOW_NODE_BOUNDS.textLength) add(issues, path, `must be an http(s) origin or at most ${AUTHORED_FLOW_NODE_BOUNDS.textLength} characters`);
}
