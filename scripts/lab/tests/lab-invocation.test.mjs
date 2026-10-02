import assert from "node:assert/strict";
import test from "node:test";
import { LAB_INVOCATION_VARIABLE, labInvocationEnvironment } from "../lab-invocation.mjs";

test("the Lab hands the runner its own arguments and the names, never the values, of the FLUXIQ_ variables it was given", () => {
  const env = { FLUXIQ_LAB_INSTANCE: "t194-slot-3", FLUXIQ_TEST_RUNS_DIR: "C:/runs", DEEPSEEK_API_KEY: "sk-secret", PATH: "/bin" };
  const passed = labInvocationEnvironment(["live", "--scenario", "everything-store"], env);
  assert.deepEqual(Object.keys(passed), [LAB_INVOCATION_VARIABLE]);
  assert.deepEqual(JSON.parse(passed[LAB_INVOCATION_VARIABLE]), {
    script: "scripts/lab/run-lab.mjs",
    args: ["live", "--scenario", "everything-store"],
    environment: ["FLUXIQ_LAB_INSTANCE", "FLUXIQ_TEST_RUNS_DIR"],
  });
  assert.doesNotMatch(passed[LAB_INVOCATION_VARIABLE], /t194-slot-3|C:\/runs|sk-secret/u);
});

test("a record inherited from an outer Lab is not itself listed as a variable the person set", () => {
  const passed = labInvocationEnvironment([], { [LAB_INVOCATION_VARIABLE]: "{}", FLUXIQ_A: "1" });
  assert.deepEqual(JSON.parse(passed[LAB_INVOCATION_VARIABLE]).environment, ["FLUXIQ_A"]);
});
