// The replay secrets a Lab child is given: valued from the scenario's own
// fixture, never from the machine the campaign runs on.

import assert from "node:assert/strict";
import test from "node:test";
import { fixtureSecretEnvironment, labEnvironment } from "../index.mjs";

const typed = (id, value) => ({ id, operation: "type", target: `testid:${id}`, value });

// Shaped like auth-gate (a secret on the primary script) and sensitive-input
// (secrets on the primary script, run with a workflow that types none of them):
// the Flow lane requires every declared secret, whichever workflow runs.
test("each declared secret is valued from the one step it names, in the primary script or a workflow's", () => {
  const manifest = {
    id: "auth-gate",
    recordingScript: [typed("enter-username", "demo.user"), typed("enter-password", "fixture-value-1"), { id: "submit", operation: "click", target: "testid:sign-in" }],
    workflows: [{ id: "extract-cards", recordingScript: [typed("enter-card", "fixture-value-2"), { id: "cards", operation: "checkpoint" }] }],
    secrets: [{ id: "auth-gate-password", step: "enter-password" }, { id: "auth-gate-card", step: "enter-card" }],
  };
  assert.deepEqual(fixtureSecretEnvironment(manifest), {
    FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD: "fixture-value-1",
    FLUXIQ_TEST_SECRET_AUTH_GATE_CARD: "fixture-value-2",
  }, "the variable is the id upper-cased with hyphens as underscores, as the Lab's declaredSecretEnvironmentName names it");
});

test("a declaration the fixture cannot value is left unset, so the Lab refuses it by name", () => {
  const manifest = {
    id: "s",
    recordingScript: [typed("a", "one"), typed("b", ""), { id: "c", operation: "click", target: "testid:c" }],
    workflows: [{ id: "w", recordingScript: [typed("a", "two")] }],
    secrets: [{ id: "two-values", step: "a" }, { id: "empty", step: "b" }, { id: "clicked", step: "c" }, { id: "absent", step: "nowhere" }],
  };
  assert.deepEqual(fixtureSecretEnvironment(manifest), {});
  assert.deepEqual(fixtureSecretEnvironment({ id: "plain", recordingScript: [typed("a", "x")] }), {}, "no declaration, no variable");
  assert.deepEqual(fixtureSecretEnvironment(undefined), {}, "an unknown scenario has nothing to give");
  const sameTwice = { id: "s", recordingScript: [typed("a", "one")], workflows: [{ id: "w", recordingScript: [typed("a", "one")] }], secrets: [{ id: "same", step: "a" }] };
  assert.deepEqual(fixtureSecretEnvironment(sameTwice), { FLUXIQ_TEST_SECRET_SAME: "one" }, "one value written twice is still one value");
});

test("a Lab child gets the fixture's secrets and never the machine's, and builds one workspace at a time", () => {
  const machine = {
    PATH: "p", NPM_CONFIG_WORKSPACE_CONCURRENCY: "8", FLUXIQ_TEST_SECRETS_NOTE: "kept",
    FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD: "machine-value", fluxiq_test_secret_other: "machine-value",
  };
  assert.deepEqual(labEnvironment(machine, { FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD: "fixture-value" }), {
    PATH: "p", FLUXIQ_TEST_SECRETS_NOTE: "kept", FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD: "fixture-value", npm_config_workspace_concurrency: "1",
  });
  assert.deepEqual(labEnvironment(machine), { PATH: "p", FLUXIQ_TEST_SECRETS_NOTE: "kept", npm_config_workspace_concurrency: "1" });
  assert.throws(() => labEnvironment({}, { PATH: "x" }), /only FLUXIQ_TEST_SECRET_/u, "the fixture can set a secret and nothing else");
});
