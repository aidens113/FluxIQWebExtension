import assert from "node:assert/strict";
import test from "node:test";
import { ContractValidationError, assertWebScenario, parseWebScenarioJson, validateWebScenario, webScenarioJsonSchema } from "../dist/index.js";

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
