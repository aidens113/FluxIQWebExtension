import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { resolveLabPaths } from "../resolve-lab-paths.js";

const ROOT = path.resolve("F:/repo");

test("with no Lab instance every path is the repository default", () => {
  const paths = resolveLabPaths(ROOT, {});
  assert.equal(paths.instance, null);
  assert.equal(paths.extensionPath, path.join(ROOT, "apps", "extension", "dist", "e2e-chromium"));
  assert.equal(paths.scenarioEntrypoint, path.join(ROOT, "apps", "scenario-lab", "dist", "server.js"));
  assert.equal(paths.scenarioLabDist, path.join(ROOT, "apps", "scenario-lab", "dist"));
  assert.equal(paths.runsDirectory, path.join(ROOT, "test-runs"));
  assert.equal(paths.hostPrebuilt, false);
});

test("an instance takes its build paths from the launcher and its runs from its own label", () => {
  const paths = resolveLabPaths(ROOT, {
    FLUXIQ_LAB_INSTANCE: "lab-a",
    FLUXIQ_LAB_EXTENSION_PATH: path.join(ROOT, ".lab-instances", "lab-a", "extension", "dist", "e2e-chromium"),
    FLUXIQ_LAB_SCENARIO_ENTRYPOINT: path.join(ROOT, ".lab-instances", "lab-a", "scenario-lab", "dist", "server.js"),
    FLUXIQ_LAB_HOST_MODULE: path.join(ROOT, ".lab-instances", "lab-a", "host", "web-panel-host.mjs"),
  });
  assert.equal(paths.instance, "lab-a");
  assert.equal(paths.extensionPath, path.join(ROOT, ".lab-instances", "lab-a", "extension", "dist", "e2e-chromium"));
  assert.equal(paths.scenarioLabDist, path.join(ROOT, ".lab-instances", "lab-a", "scenario-lab", "dist"));
  assert.equal(paths.hostModulePath, path.join(ROOT, ".lab-instances", "lab-a", "host", "web-panel-host.mjs"));
  assert.equal(paths.hostPrebuilt, true);
  assert.equal(paths.runsDirectory, path.join(ROOT, "test-runs", "instances", "lab-a"));
});

test("two instances write their run state to different directories", () => {
  const environment = (instance: string) => ({
    FLUXIQ_LAB_INSTANCE: instance,
    FLUXIQ_LAB_EXTENSION_PATH: path.join(ROOT, ".lab-instances", instance, "extension", "dist", "e2e-chromium"),
    FLUXIQ_LAB_SCENARIO_ENTRYPOINT: path.join(ROOT, ".lab-instances", instance, "scenario-lab", "dist", "server.js"),
  });
  const first = resolveLabPaths(ROOT, environment("lab-a"));
  const second = resolveLabPaths(ROOT, environment("lab-b"));
  assert.notEqual(first.runsDirectory, second.runsDirectory);
  assert.notEqual(first.extensionPath, second.extensionPath);
  assert.notEqual(first.scenarioEntrypoint, second.scenarioEntrypoint);
});

test("an explicit runs directory still wins over the instance default", () => {
  const paths = resolveLabPaths(ROOT, {
    FLUXIQ_LAB_INSTANCE: "lab-a",
    FLUXIQ_LAB_EXTENSION_PATH: path.join(ROOT, "x", "e2e-chromium"),
    FLUXIQ_LAB_SCENARIO_ENTRYPOINT: path.join(ROOT, "x", "server.js"),
    FLUXIQ_TEST_RUNS_DIR: path.join(ROOT, "elsewhere"),
  });
  assert.equal(paths.runsDirectory, path.join(ROOT, "elsewhere"));
});

test("an instance without the launcher's paths fails closed rather than guessing a build", () => {
  assert.throws(() => resolveLabPaths(ROOT, { FLUXIQ_LAB_INSTANCE: "lab-a" }), /FLUXIQ_LAB_EXTENSION_PATH/u);
  assert.throws(
    () => resolveLabPaths(ROOT, { FLUXIQ_LAB_INSTANCE: "lab-a", FLUXIQ_LAB_EXTENSION_PATH: path.join(ROOT, "x") }),
    /FLUXIQ_LAB_SCENARIO_ENTRYPOINT/u,
  );
});

test("an unusable instance name is refused", () => {
  for (const name of ["Lab A", "../escape", "lab_a", "-lab"]) {
    assert.throws(() => resolveLabPaths(ROOT, { FLUXIQ_LAB_INSTANCE: name }), /lowercase kebab-case/u);
  }
});
