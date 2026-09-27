import assert from "node:assert/strict";
import test from "node:test";
import { configuredCredentials } from "../configured-credentials.js";

test("a username and a password together are an account an isolated Core can be bootstrapped with", () => {
  assert.deepEqual(configuredCredentials({ FLUXIQ_TEST_USERNAME: "lab@example.test", FLUXIQ_TEST_PASSWORD: "pw" }), { username: "lab@example.test", password: "pw" });
  assert.deepEqual(
    configuredCredentials({ FLUXIQ_TEST_USERNAME: "lab@example.test", FLUXIQ_TEST_PASSWORD: "pw", FLUXIQ_TEST_TOTP: "seed", FLUXIQ_TEST_PIN: "123456" }),
    { username: "lab@example.test", password: "pw", totp: "seed", pin: "123456" },
  );
});

/**
 * Half an account is no account. Passing one through would have the topology
 * start a bootstrap it cannot finish, and the failure arrives from inside Core's
 * own setup rather than as a missing-environment refusal the bench can skip.
 */
test("either half missing, or empty, configures no account at all", () => {
  assert.equal(configuredCredentials({}), undefined);
  assert.equal(configuredCredentials({ FLUXIQ_TEST_USERNAME: "lab@example.test" }), undefined);
  assert.equal(configuredCredentials({ FLUXIQ_TEST_PASSWORD: "pw" }), undefined);
  assert.equal(configuredCredentials({ FLUXIQ_TEST_USERNAME: "", FLUXIQ_TEST_PASSWORD: "pw" }), undefined);
  assert.equal(configuredCredentials({ FLUXIQ_TEST_USERNAME: "lab@example.test", FLUXIQ_TEST_PASSWORD: "" }), undefined);
});

test("an unset or empty TOTP or PIN is absent from the account, never present holding undefined", () => {
  const credentials = configuredCredentials({ FLUXIQ_TEST_USERNAME: "lab@example.test", FLUXIQ_TEST_PASSWORD: "pw", FLUXIQ_TEST_TOTP: "", FLUXIQ_TEST_PIN: undefined });
  assert.deepEqual(Object.keys(credentials ?? {}), ["username", "password"]);
});
