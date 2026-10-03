import assert from "node:assert/strict";
import test from "node:test";
import { LAB_INVOCATION_VARIABLE, SCREENED_ARGUMENT, runInvocation } from "../run-invocation.js";

test("a run the Lab started records the Lab's own arguments and the FLUXIQ_ variable names it was given, never their values", () => {
  const env = {
    [LAB_INVOCATION_VARIABLE]: JSON.stringify({ script: "scripts/lab/run-lab.mjs", args: ["live", "--scenario", "everything-store", "--workflow", "plus-under-fifty"], environment: ["FLUXIQ_LAB_INSTANCE", "FLUXIQ_TEST_RUNS_DIR"] }),
    FLUXIQ_LAB_EXTENSION_PATH: "C:/secret/place",
    DEEPSEEK_API_KEY: "sk-FAKE-test-value-not-a-real-key",
  };
  const invocation = runInvocation(env, ["live", "--scenario", "everything-store", "--workflow", "plus-under-fifty"]);
  assert.deepEqual(invocation, {
    via: "run-lab",
    script: "scripts/lab/run-lab.mjs",
    args: ["live", "--scenario", "everything-store", "--workflow", "plus-under-fifty"],
    fluxiqEnvironment: ["FLUXIQ_LAB_INSTANCE", "FLUXIQ_TEST_RUNS_DIR"],
  });
  assert.doesNotMatch(JSON.stringify(invocation), /secret\/place|sk-FAKE/u);
});

test("a run started without the Lab records the runner's own arguments and FLUXIQ_ names, sorted", () => {
  const invocation = runInvocation({ FLUXIQ_B: "1", FLUXIQ_A: "x", PATH: "/bin", fluxiq_lower: "no" }, ["run", "--scenario", "a"]);
  assert.deepEqual(invocation, { via: "test-runner", args: ["run", "--scenario", "a"], fluxiqEnvironment: ["FLUXIQ_A", "FLUXIQ_B"] });
});

test("anything secret-shaped in the arguments is screened, by the flag's name and by the value's shape", () => {
  const invocation = runInvocation({}, [
    "--token=abc", "--api-key", "plainvalue", "--password", "hunter2", "--scenario", "kettle",
    "sk-FAKE-test-value-not-a-real-key", "Bearer abc.def.ghi", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl",
    "0123456789abcdef0123456789abcdef0123", "--note=token=xyz",
  ]);
  assert.deepEqual(invocation.args, [
    `--token=${SCREENED_ARGUMENT}`, "--api-key", SCREENED_ARGUMENT, "--password", SCREENED_ARGUMENT, "--scenario", "kettle",
    SCREENED_ARGUMENT, SCREENED_ARGUMENT, SCREENED_ARGUMENT, SCREENED_ARGUMENT, SCREENED_ARGUMENT,
  ]);
});

test("an unreadable Lab record is said, and the runner's own arguments stand in for it", () => {
  const invocation = runInvocation({ [LAB_INVOCATION_VARIABLE]: "{not json", FLUXIQ_X: "1" }, ["run"]);
  assert.deepEqual(invocation, { via: "test-runner", labInvocation: "unreadable", args: ["run"], fluxiqEnvironment: ["FLUXIQ_X"] });
});

test("the Lab record's variable names are kept only when they are FLUXIQ_ names, and the record's own variable is never listed", () => {
  const env = { [LAB_INVOCATION_VARIABLE]: JSON.stringify({ script: "scripts/lab/run-lab.mjs", args: [], environment: ["FLUXIQ_OK", "OTHER", "FLUXIQ_BAD=value", 7] }) };
  assert.deepEqual(runInvocation(env, []).fluxiqEnvironment, ["FLUXIQ_OK"]);
  assert.deepEqual(runInvocation({ [LAB_INVOCATION_VARIABLE]: "{}" }, []).fluxiqEnvironment, []);
});
