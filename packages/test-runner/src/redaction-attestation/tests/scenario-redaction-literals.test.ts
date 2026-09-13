import assert from "node:assert/strict";
import test from "node:test";
import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { scenarioRedactionLiterals, type RedactionLiteralScenario } from "../index.js";

const typed = (id: string, value: string): ScenarioStep => ({ id, operation: "type", target: `testid:${id}`, value });

function scenario(overrides: Partial<RedactionLiteralScenario>): RedactionLiteralScenario {
  return { id: "fixture", recordingScript: [], ...overrides };
}

test("the literals are the recorded values of the declared steps, across every script, once each", () => {
  const literals = scenarioRedactionLiterals(scenario({
    recordingScript: [typed("enter-email", "someone@example.test"), typed("enter-password", "fixture-demo-password")],
    workflows: [{ id: "checkout", description: "Checkout", recordingScript: [typed("enter-password", "fixture-demo-password"), typed("enter-card", "4000000000000000")], expected: {} }],
    secrets: [{ id: "fixture-password", step: "enter-password" }, { id: "fixture-card", step: "enter-card" }],
  }));

  // The undeclared email is typed too, and is not a literal: only a declaration makes a value secret.
  assert.deepEqual(literals, ["fixture-demo-password", "4000000000000000"]);
});

test("a scenario that declares no secret has no literal", () => {
  assert.deepEqual(scenarioRedactionLiterals(scenario({ recordingScript: [typed("enter-password", "fixture-demo-password")] })), []);
});

test("a declaration naming no recorded step fails as an invalid fixture", () => {
  assert.throws(
    () => scenarioRedactionLiterals(scenario({ recordingScript: [typed("enter-password", "fixture-demo-password")], secrets: [{ id: "fixture-card", step: "enter-card" }] })),
    error => error instanceof RunnerFailure && error.category === "fixture.invalid" && error.message.includes("enter-card"),
  );
});

test("a declared value too short to scan for fails as an invalid fixture without naming the value", () => {
  assert.throws(
    () => scenarioRedactionLiterals(scenario({ recordingScript: [typed("enter-pin", "7391")], secrets: [{ id: "fixture-pin", step: "enter-pin" }] })),
    error => error instanceof RunnerFailure && error.category === "fixture.invalid" && !error.message.includes("7391"),
  );
});
