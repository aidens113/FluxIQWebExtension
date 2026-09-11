import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES as coreFailureClasses } from "@fluxiq/contracts/automation-studio";
import { ContractValidationError, assertWebScenario, parseWebScenarioJson, resolveScenarioWorkflow, AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES, scenarioStepOperations, validateWebScenario, webScenarioJsonSchema } from "../dist/index.js";

const validScenario = {
  schemaVersion: "0.1",
  id: "basic-form",
  title: "Basic form",
  tags: ["forms", "smoke"],
  seed: 42,
  startPath: "/scenarios/basic-form",
  capabilities: ["forms", "navigation"],
  networkPolicy: "loopback-only",
  recordingScript: [
    { id: "name", operation: "type", target: "name", value: "Ada" },
    { id: "submit", operation: "click", target: "submit" },
    { id: "done", operation: "checkpoint" },
  ],
  expected: { finalState: [{ id: "submitted", subject: "result", predicate: "text", value: "Hello Ada" }] },
};

test("accepts a valid scenario and preserves its typed value", () => {
  const result = validateWebScenario(validScenario);
  assert.equal(result.valid, true);
  assert.equal(result.valid && result.value.id, "basic-form");
  assert.doesNotThrow(() => assertWebScenario(validScenario));
});

test("rejects invalid scenarios before a runner can start", () => {
  const invalid = { ...validScenario, id: "Basic Form", startPath: "https://example.com", networkPolicy: "anything-goes", recordingScript: [{ id: "missing-target", operation: "click" }], unexpected: true };
  const result = validateWebScenario(invalid);
  assert.equal(result.valid, false);
  assert.ok(!result.valid && result.issues.some((entry) => entry.path === "$.id"));
  assert.ok(!result.valid && result.issues.some((entry) => entry.path === "$.recordingScript[0].target"));
  assert.throws(() => assertWebScenario(invalid), ContractValidationError);
});

test("rejects malformed JSON with a contract error", () => {
  assert.throws(() => parseWebScenarioJson("{"), ContractValidationError);
});

test("exports a standalone versioned JSON schema", () => {
  assert.equal(webScenarioJsonSchema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(webScenarioJsonSchema.properties.schemaVersion.const, "0.1");
  assert.ok(webScenarioJsonSchema.required.includes("recordingScript"));
});

test("allows an empty recording script only for an explicit playback goal", () => {
  const instructionOnly = {
    ...validScenario,
    id: "instruction-only-form",
    recordingScript: [],
    playbackGoal: {
      id: "submit",
      description: "Complete the form from instructions.",
      successFacts: [{ id: "submitted", subject: "result", predicate: "text", value: "Submitted" }],
    },
  };
  assert.equal(validateWebScenario(instructionOnly).valid, true);
  const missingGoal = validateWebScenario({ ...instructionOnly, playbackGoal: undefined });
  assert.equal(missingGoal.valid, false);
  assert.ok(!missingGoal.valid && missingGoal.issues.some(issue => issue.path === "$.recordingScript"));
  assert.equal(webScenarioJsonSchema.properties.recordingScript.minItems, undefined);
  assert.deepEqual(webScenarioJsonSchema.allOf[0].then.required, ["playbackGoal"]);
});

const catalogScenario = {
  ...validScenario,
  id: "product-catalog",
  recordingScript: [
    { id: "search", operation: "type", target: "testid:search", value: "lamp" },
    { id: "submit", operation: "press", target: "testid:search", value: "Enter" },
    { id: "in-stock", operation: "check", target: "testid:in-stock", value: true },
    { id: "products", operation: "extract", target: "testid:product", fields: { name: "testid:name", url: "testid:link@href" } },
  ],
  expected: { extracted: [{ step: "products", count: 2, records: [{ name: "Lamp", url: "/p/1" }, { name: "Desk lamp", url: "/p/2" }] }] },
  variants: [
    { id: "no-results", description: "Search returns nothing.", arm: { operation: "set-mode", payload: { mode: "empty" } }, expected: { extracted: [{ step: "products", count: 0 }] } },
    { id: "session-expired", description: "Login is required mid-run.", arm: { operation: "expire" }, expected: { failure: { category: "auth_required" } } },
  ],
  workflows: [{
    id: "paginated",
    description: "Extract every page by following Next.",
    recordingScript: [{ id: "all-products", operation: "extract", target: "testid:product", fields: { name: "testid:name" }, pagination: { next: "testid:next", maxPages: 5 } }],
    expected: { extracted: [{ step: "all-products", count: 23 }] },
    variants: [{ id: "short-catalog", description: "Only one page exists.", arm: { operation: "set-mode", payload: { mode: "short" } }, expected: { extracted: [{ step: "all-products", count: 6 }] } }],
  }],
};

test("accepts workflows, variants, extraction steps, and expected failures", () => {
  const result = validateWebScenario(catalogScenario);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.ok(scenarioStepOperations.includes("extract"));
  assert.ok(AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES.includes("auth_required"));
});

test("resolves the primary or a named workflow, and a variant replaces only the fields it sets", () => {
  const primary = resolveScenarioWorkflow(catalogScenario);
  assert.equal(primary.workflowId, undefined);
  assert.equal(primary.recordingScript, catalogScenario.recordingScript);
  assert.deepEqual(primary.expected, catalogScenario.expected);
  assert.deepEqual(resolveScenarioWorkflow(catalogScenario, { variantId: "no-results" }).expected.extracted, [{ step: "products", count: 0 }]);
  const expired = resolveScenarioWorkflow(catalogScenario, { variantId: "session-expired" });
  assert.deepEqual(expired.expected.failure, { category: "auth_required" });
  assert.deepEqual(expired.expected.extracted, catalogScenario.expected.extracted);
  const short = resolveScenarioWorkflow(catalogScenario, { workflowId: "paginated", variantId: "short-catalog" });
  assert.equal(short.recordingScript[0].id, "all-products");
  assert.deepEqual(short.expected.extracted, [{ step: "all-products", count: 6 }]);
  assert.equal(short.variant.arm.operation, "set-mode");
  assert.throws(() => resolveScenarioWorkflow(catalogScenario, { workflowId: "missing" }), /has no workflow missing/);
  assert.throws(() => resolveScenarioWorkflow(catalogScenario, { variantId: "short-catalog" }), /has no variant short-catalog/);
});

test("rejects malformed workflows, variants, extraction, and step values", () => {
  const invalid = {
    ...catalogScenario,
    recordingScript: [
      { id: "press", operation: "press", target: "testid:search" },
      { id: "check", operation: "check", target: "testid:box", value: "yes" },
      { id: "click", operation: "click", target: "testid:x", fields: { name: "testid:name" } },
      { id: "products", operation: "extract", target: "testid:product", fields: {}, pagination: { next: "testid:next", maxPages: 0 } },
      { id: "tab", operation: "switchTab" },
    ],
    expected: { extracted: [{ step: "click", count: 1 }], failure: { category: "NOT_A_CATEGORY" } },
    variants: [
      { id: "dup", description: "one", arm: { operation: "a" }, expected: {} },
      { id: "dup", description: "two", arm: {}, expected: { extracted: [{ step: "products" }] } },
    ],
    workflows: [
      { id: "empty", description: "No steps.", recordingScript: [], expected: {} },
      { id: "empty", description: "Borrows a primary step.", recordingScript: [{ id: "noop", operation: "checkpoint" }], expected: { extracted: [{ step: "products", count: 1 }] } },
    ],
  };
  const result = validateWebScenario(invalid);
  assert.equal(result.valid, false);
  const paths = result.valid ? [] : result.issues.map((entry) => entry.path);
  for (const path of [
    "$.recordingScript[0].value", "$.recordingScript[1].value", "$.recordingScript[2].fields",
    "$.recordingScript[3].fields", "$.recordingScript[3].pagination.maxPages", "$.recordingScript[4].path",
    "$.expected.extracted[0].step", "$.expected.failure.category",
    "$.variants", "$.variants[1].arm.operation", "$.variants[1].expected.extracted[0]",
    "$.workflows", "$.workflows[0].recordingScript", "$.workflows[1].expected.extracted[0].step",
  ]) assert.ok(paths.includes(path), `expected an issue at ${path}; got ${paths.join(", ")}`);
});

test("the JSON schema lists every step operation and failure category", () => {
  assert.deepEqual([...webScenarioJsonSchema.$defs.step.properties.operation.enum], [...scenarioStepOperations]);
  assert.deepEqual([...webScenarioJsonSchema.$defs.failure.properties.category.enum], [...AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES]);
  // The categories are Core's own list, re-exported, not a copy that can drift from it.
  assert.equal(AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES, coreFailureClasses);
  assert.ok(webScenarioJsonSchema.properties.variants);
  assert.ok(webScenarioJsonSchema.properties.workflows);
});
