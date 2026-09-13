import assert from "node:assert/strict";
import test from "node:test";
import { declaredSecretEnvironmentName, declaredSecretFlowInputs, declaredSecretValues, resolveDeclaredSecrets, type SecretDeclaringScenario } from "../declared-secrets.js";
import { RunnerFailure } from "../../failure.js";

/**
 * Shaped like auth-gate, the one scenario that declares a secret: a recorded
 * password step, and a declaration naming it. `RECORDED` stands for whatever
 * the recording holds for that step; nothing may ever resolve to it.
 */
const RECORDED = "value-the-recording-holds";
const scenario: SecretDeclaringScenario = {
  id: "auth-gate",
  recordingScript: [
    { id: "enter-username", operation: "type", target: "testid:username", value: "demo.user" },
    { id: "enter-password", operation: "type", target: "testid:password", value: RECORDED },
    { id: "submit-sign-in", operation: "click", target: "testid:sign-in" },
  ],
  secrets: [{ id: "auth-gate-password", step: "enter-password" }],
};

test("a secret id becomes an upper-case environment variable name", () => {
  assert.equal(declaredSecretEnvironmentName("auth-gate-password"), "FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD");
  assert.equal(declaredSecretEnvironmentName("totp"), "FLUXIQ_TEST_SECRET_TOTP");
});

test("declared secrets take their value from the environment, never from the recording", () => {
  const resolved = resolveDeclaredSecrets(scenario, { FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD: "supplied-at-replay" });
  assert.deepEqual(resolved, [{ id: "auth-gate-password", step: "enter-password", value: "supplied-at-replay" }]);
  assert.deepEqual(declaredSecretFlowInputs(resolved), { "auth-gate-password": "supplied-at-replay" });
  assert.deepEqual(declaredSecretValues(resolved), ["supplied-at-replay"]);
  // The declaration names the recorded step, so the recorded value is in
  // reach; the resolver must still never be the thing that reaches for it.
  assert.equal(JSON.stringify(resolved).includes(RECORDED), false);
});

test("an undeclared or unset secret fails closed rather than falling back to the recorded value", () => {
  assert.throws(
    () => resolveDeclaredSecrets(scenario, {}),
    (error: unknown) => error instanceof RunnerFailure && error.category === "environment.missing" && /FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD/.test(error.message),
  );
  assert.throws(() => resolveDeclaredSecrets(scenario, { FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD: "" }), /must be set/);
  // The value is absent, so the recorded one must not be substituted anywhere:
  // an empty variable yields no secret at all rather than an empty-valued one.
  try { resolveDeclaredSecrets(scenario, { FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD: "" }); }
  catch (error) { assert.equal(JSON.stringify((error as RunnerFailure).details ?? {}).includes(RECORDED), false); }
});

/**
 * The failure a declaration typo would otherwise become: an input keyed by a
 * secret nothing recorded, while the step it was meant to replace keeps
 * whatever the recording holds. Inert wiring is what this plan keeps finding,
 * so a declaration that names no recorded step is a run failure.
 */
test("a declaration that names no recorded step fails the run instead of resolving to nothing", () => {
  const stale = { ...scenario, secrets: [{ id: "auth-gate-password", step: "enter-passphrase" }] };
  assert.throws(
    () => resolveDeclaredSecrets(stale, { FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD: "supplied-at-replay" }),
    (error: unknown) => error instanceof RunnerFailure && error.category === "fixture.invalid" && /enter-passphrase/.test(error.message),
  );
  // A step recorded by a further workflow rather than the primary script counts.
  const workflow = { ...stale, workflows: [{ id: "second", description: "another workflow", recordingScript: [{ id: "enter-passphrase", operation: "type" as const, target: "testid:passphrase" }], expected: {} }] };
  assert.deepEqual(resolveDeclaredSecrets(workflow, { FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD: "supplied-at-replay" }).map(secret => secret.step), ["enter-passphrase"]);
});

test("a scenario declaring no secret resolves to none", () => {
  assert.deepEqual(resolveDeclaredSecrets({ id: "basic-form", recordingScript: [] }, {}), []);
  assert.deepEqual(resolveDeclaredSecrets({ ...scenario, secrets: [] }, {}), []);
  assert.deepEqual(declaredSecretFlowInputs([]), {});
});
