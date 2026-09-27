import assert from "node:assert/strict";
import test from "node:test";
import type { ResolvedScenarioWorkflow, WebScenario } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { resolveRunSecrets } from "../resolve-run-secrets.js";

const TYPED = "correct-horse-battery";

const scenario: WebScenario = {
  schemaVersion: "0.1",
  id: "auth-gate",
  title: "A fixture whose password is supplied at replay",
  tags: ["auth"],
  seed: 3,
  startPath: "/scenarios/auth-gate/",
  capabilities: [],
  networkPolicy: "loopback-only",
  recordingScript: [
    { id: "username", operation: "type", target: "[data-testid=username]", value: "lab@example.test" },
    { id: "password", operation: "type", target: "[data-testid=password]", value: TYPED },
  ],
  expected: {},
  secrets: [{ id: "auth-gate-password", step: "password" }],
};

const workflow = { workflowId: "primary", recordingScript: scenario.recordingScript, expected: scenario.expected } as unknown as ResolvedScenarioWorkflow;

const isolated = { mode: "isolated" as const };
const environment = { FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD: "replayed-password", FLUXIQ_TEST_PASSWORD: "account-password", FLUXIQ_TEST_PIN: "123456" };
const input = (overrides: Partial<Parameters<typeof resolveRunSecrets>[0]> = {}) =>
  ({ scenario, workflow, environment, target: isolated, recordedFlowLane: false, createdFlowLane: false, ...overrides }) as Parameters<typeof resolveRunSecrets>[0];

test("the recording lane needs no declared secret configured, and still scrubs the run's own credentials", () => {
  const resolved = resolveRunSecrets(input());
  assert.deepEqual(resolved.declaredSecrets, [], "a recording-lane run of the same scenario supplies nothing at replay");
  assert.deepEqual(resolved.secrets, ["account-password", "123456"]);
  assert.deepEqual(resolved.redactionLiterals, [TYPED], "the attestation still hunts for the value the recorder was meant to withhold");
});

test("the recording-built Flow lane resolves the scenario's declarations, and their values join what the bundle scrubs", () => {
  const resolved = resolveRunSecrets(input({ recordedFlowLane: true }));
  assert.deepEqual(resolved.declaredSecrets.map(secret => [secret.id, secret.value]), [["auth-gate-password", "replayed-password"]]);
  assert.deepEqual(resolved.secrets, ["account-password", "123456", "replayed-password"]);
});

test("the instruction-built lane narrows the declarations to the steps its resolved workflow holds", () => {
  const otherWorkflow = { workflowId: "other", recordingScript: [{ id: "username", operation: "type", target: "[data-testid=username]", value: "lab@example.test" }], expected: {} } as unknown as ResolvedScenarioWorkflow;
  assert.deepEqual(resolveRunSecrets(input({ createdFlowLane: true })).declaredSecrets.map(secret => secret.id), ["auth-gate-password"]);
  assert.deepEqual(resolveRunSecrets(input({ createdFlowLane: true, workflow: otherWorkflow })).declaredSecrets, [], "a workflow that never types the password asks for none");
});

/**
 * The literals are deliberately not in `secrets`. The bundle's redactor would
 * scrub them as it wrote, and the attestation's whole job is to scan the finished
 * run for one that escaped -- scrubbing them first hides exactly the leak it looks
 * for.
 */
test("a declared literal is never added to what the bundle scrubs", () => {
  const resolved = resolveRunSecrets(input({ recordedFlowLane: true }));
  assert.equal(resolved.secrets.includes(TYPED), false);
  assert.equal(resolved.redactionLiterals?.includes(TYPED), true);
});

test("a live run's provider credential joins the literals the finished run is scanned for", () => {
  assert.deepEqual(resolveRunSecrets(input({ live: { redactionLiterals: ["sk-provider-key"] } })).redactionLiterals, [TYPED, "sk-provider-key"]);
});

/**
 * The existing target's FluxIQ is remote, so its storage cannot be scanned. No
 * literals means the attestation reports `pending` rather than claiming a
 * verification it could not make.
 */
test("a scenario declaring literals against a remote FluxIQ stays unattested rather than falsely verified", () => {
  assert.equal(resolveRunSecrets(input({ target: { mode: "existing" } as Parameters<typeof resolveRunSecrets>[0]["target"] })).redactionLiterals, undefined);
  const noSecrets = { ...scenario, secrets: [] };
  assert.deepEqual(resolveRunSecrets(input({ scenario: noSecrets, target: { mode: "existing" } as Parameters<typeof resolveRunSecrets>[0]["target"] })).redactionLiterals, [], "a scenario that declares none is attested normally, with nothing to find");
});

test("a declared secret the environment does not supply fails the run closed, before a bundle exists", () => {
  assert.throws(
    () => resolveRunSecrets(input({ recordedFlowLane: true, environment: {} })),
    (error: unknown) => error instanceof RunnerFailure && error.category === "environment.missing" && /FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD must be set/u.test(error.message),
  );
});
