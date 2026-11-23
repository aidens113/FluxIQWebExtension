import assert from "node:assert/strict";
import test from "node:test";
import { providerFreeWhenScripted } from "../provider-free-run.mjs";

const standIn = ["stand", "in", "provider", "value"].join("-");
const key = ["CLAUDE", "API", "KEY"].join("_");

test("a scripted attempt's runner gets no key and opens no env file of this checkout", () => {
  const passed = providerFreeWhenScripted(["attempt", "company-website", "--task", "x", "--scripted-model"], { [key]: standIn, PATH: "/bin" });
  assert.equal(passed[key], undefined);
  assert.equal(passed.PATH, "/bin");
  assert.equal(passed.FLUXIQ_PROVIDER_KEY_FILES, "none");
  assert.equal(passed.FLUXIQ_TEST_ENV_FILES, "none");
});

test("every other run's environment is handed on as it came", () => {
  const env = { [key]: standIn };
  assert.equal(providerFreeWhenScripted(["attempt", "company-website", "--task", "x", "--live-llm"], env), env);
  assert.equal(providerFreeWhenScripted(["run", "company-website", "--scripted-model"], env), env);
});

test("recorded and preflight runners cannot inherit provider credentials", () => {
  for (const args of [["recorded-replay", "--input", "recording.json"], ["recorded-capture", "company-website"], ["recorded-read", "everything-store"], ["offline-preflight", "company-website"], ["attempt", "company-website", "--recorded-model", "recording.json"]]) {
    const passed = providerFreeWhenScripted(args, { [key]: standIn, PATH: "/bin" });
    assert.equal(passed[key], undefined);
    assert.equal(passed.PATH, "/bin");
    assert.equal(passed.FLUXIQ_PROVIDER_KEY_FILES, "none");
    assert.equal(passed.FLUXIQ_TEST_ENV_FILES, "none");
  }
});

test("a managed-host proof is credential-free even before its flags are parsed", () => {
  for (const args of [["fluxnode-host"], ["fluxnode-host", "--scripted-model", "--lifecycle-only"]]) {
    const passed = providerFreeWhenScripted(args, { [key]: standIn, PATH: "/bin" });
    assert.equal(passed[key], undefined);
    assert.equal(passed.FLUXIQ_PROVIDER_KEY_FILES, "none");
    assert.equal(passed.FLUXIQ_TEST_ENV_FILES, "none");
  }
});

test("a recovery-matrix run gets no key, opens no env file and runs on the isolated target (t968)", () => {
  for (const args of [["recovery-matrix", "--case", "14"], ["recovery-matrix", "--list"]]) {
    const passed = providerFreeWhenScripted(args, { [key]: standIn, PATH: "/bin", FLUXIQ_TEST_TARGET: "existing" });
    assert.equal(passed[key], undefined);
    assert.equal(passed.PATH, "/bin");
    assert.equal(passed.FLUXIQ_PROVIDER_KEY_FILES, "none");
    assert.equal(passed.FLUXIQ_TEST_ENV_FILES, "none");
    assert.equal(passed.FLUXIQ_TEST_TARGET, "isolated");
  }
});
