import assert from "node:assert/strict";
import test from "node:test";
import { declaredSecretEnvironmentName, declaredSecretFlowInputs, declaredSecretValues, resolveDeclaredSecrets } from "../declared-secrets.js";
import { RunnerFailure } from "../../failure.js";

const scenario = { id: "auth-gate", secrets: [{ id: "sign-in-password", step: "enter-password" }] };

test("a secret id becomes an upper-case environment variable name", () => {
  assert.equal(declaredSecretEnvironmentName("sign-in-password"), "FLUXIQ_TEST_SECRET_SIGN_IN_PASSWORD");
  assert.equal(declaredSecretEnvironmentName("totp"), "FLUXIQ_TEST_SECRET_TOTP");
});

test("declared secrets take their value from the environment, never from the recording", () => {
  const resolved = resolveDeclaredSecrets(scenario, { FLUXIQ_TEST_SECRET_SIGN_IN_PASSWORD: "supplied-at-replay" });
  assert.deepEqual(resolved, [{ id: "sign-in-password", step: "enter-password", value: "supplied-at-replay" }]);
  assert.deepEqual(declaredSecretFlowInputs(resolved), { "sign-in-password": "supplied-at-replay" });
  assert.deepEqual(declaredSecretValues(resolved), ["supplied-at-replay"]);
});

test("an undeclared or unset secret fails closed rather than falling back to the recorded value", () => {
  assert.throws(
    () => resolveDeclaredSecrets(scenario, {}),
    (error: unknown) => error instanceof RunnerFailure && error.category === "environment.missing" && /FLUXIQ_TEST_SECRET_SIGN_IN_PASSWORD/.test(error.message),
  );
  assert.throws(() => resolveDeclaredSecrets(scenario, { FLUXIQ_TEST_SECRET_SIGN_IN_PASSWORD: "" }), /must be set/);
});

test("a scenario declaring no secret resolves to none", () => {
  assert.deepEqual(resolveDeclaredSecrets({ id: "basic-form" }, {}), []);
  assert.deepEqual(declaredSecretFlowInputs([]), {});
});
