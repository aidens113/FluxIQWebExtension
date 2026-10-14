// Which invocations are guarded, and the instance and task they are ledgered under.

import assert from "node:assert/strict";
import test from "node:test";
import { describeLiveLaunch } from "../index.mjs";

const identity = ["--live-llm", "--llm-profile", "production", "--llm-provider", "deepseek", "--llm-model", "deepseek-flash"];

test("a live create-flow run is guarded under its instance and instruction task", () => {
  const args = ["run", "bigbox-retail", "--variant", "sale", ...identity, "--llm-task", "create-flow", "--instruction-task", "bigbox-retail-pickup-cart"];
  assert.deepEqual(describeLiveLaunch(args, { FLUXIQ_LAB_INSTANCE: "t174-slot-1" }), { instance: "t174-slot-1", scenarioId: "bigbox-retail", task: "bigbox-retail/bigbox-retail-pickup-cart/variant=sale", authoringMode: "legacy" });
});

test("a live repair run is named by its llm task and workflow; no instance is 'default'", () => {
  const args = ["run", "job-board", "--workflow", "apply", "--flow", ...identity, "--llm-task", "repair"];
  assert.deepEqual(describeLiveLaunch(args, {}), { instance: "default", scenarioId: "job-board", task: "job-board/repair/workflow=apply", authoringMode: "legacy" });
});

test("a live matrix names its one scenario", () => {
  const args = ["matrix", "--scenarios-json", "[\"photo-social\"]", ...identity, "--llm-task", "adapt"];
  assert.equal(describeLiveLaunch(args, {})?.task, "photo-social/adapt");
});

test("a launch names its --authoring-mode, and the Lab's own default (legacy) when it names none", () => {
  const args = ["run", "everything-store", ...identity, "--llm-task", "create-flow", "--instruction-task", "earbuds"];
  assert.equal(describeLiveLaunch(args, {})?.authoringMode, "legacy");
  for (const mode of ["legacy", "candidate", "project"]) assert.equal(describeLiveLaunch([...args, "--authoring-mode", mode], {})?.authoringMode, mode);
  // The mode is not part of the task: the same task in two modes is told apart by the mode alone.
  assert.equal(describeLiveLaunch([...args, "--authoring-mode", "project"], {})?.task, describeLiveLaunch(args, {})?.task);
});

test("provider-free invocations are not guarded: no --live-llm, or a --dry-run", () => {
  assert.equal(describeLiveLaunch(["run", "bigbox-retail"], {}), null);
  assert.equal(describeLiveLaunch(["inspect", "run-x"], {}), null);
  assert.equal(describeLiveLaunch(["run", "bigbox-retail", ...identity, "--llm-task", "create-flow", "--instruction-task", "x", "--dry-run"], {}), null);
});
