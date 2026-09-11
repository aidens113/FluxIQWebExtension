import assert from "node:assert/strict";
import test from "node:test";
import { assertExpectedFacts, type ScenarioFactProbe } from "../scenario-assertions.js";

function probe(overrides: Partial<ScenarioFactProbe> = {}): ScenarioFactProbe {
  return {
    text: async subject => ({ result: "Submitted replayed", missing: null }[subject] ?? "Confirmed"),
    visible: async subject => subject === "shown",
    exists: async subject => subject !== "removed",
    enabled: async subject => subject !== "disabled",
    path: async () => "/scenarios/navigation/history",
    iframeCount: async () => 2,
    labelCount: async label => label === "Email" ? 2 : 0,
    ...overrides,
  };
}

test("asserts every predicate used by the scenario corpus", async () => {
  await assertExpectedFacts([
    { id: "text", subject: "result", predicate: "text", value: "Submitted replayed" },
    { id: "contains", subject: "result", predicate: "contains", value: "replayed" },
    { id: "visible", subject: "shown", predicate: "visible", value: true },
    { id: "exists", subject: "removed", predicate: "exists", value: false },
    { id: "enabled", subject: "disabled", predicate: "enabled", value: false },
    { id: "path", subject: "document", predicate: "path", value: "/scenarios/navigation/history" },
    { id: "frames", subject: "document", predicate: "iframe-count", value: 2 },
    { id: "labels", subject: "document", predicate: "label-count:Email", value: 2 },
  ], probe());
});

test("fails closed for mismatches, unknown predicates, and invalid expected value types", async () => {
  await assert.rejects(() => assertExpectedFacts([{ id: "wrong", subject: "result", predicate: "contains", value: "absent" }], probe()), /Scenario fact failed: wrong/);
  await assert.rejects(() => assertExpectedFacts([{ id: "unknown", subject: "result", predicate: "future-predicate", value: true }], probe()), /Unsupported scenario fact predicate/);
  await assert.rejects(() => assertExpectedFacts([{ id: "typed", subject: "shown", predicate: "visible", value: "true" }], probe()), /requires a boolean/);
});

test("a candidate page with missing state cannot be selected as successful", async () => {
  await assert.rejects(() => assertExpectedFacts([{ id: "required", subject: "missing", predicate: "text", value: "Ready" }], probe()), /Scenario fact failed/);
  await assert.rejects(() => assertExpectedFacts([{ id: "required", subject: "missing", predicate: "contains", value: "Ready" }], probe()), /Scenario fact failed/);
});
