import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readRunBundle } from "../bundle.mjs";

test("the bundle reader retains a call's screened refusal account in its existing Flow snapshot", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fluxiq-refusal-bundle-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, "snapshots"));
  const diagnostic = { schemaVersion: "web-build-refusal.v1", phase: "before_action", code: "blocked_by_dialog", pageObserved: true, target: "t1", targetObserved: true, coveringTargets: ["t2"], coveringKinds: ["consent"], coveringCount: 1 };
  const snapshot = { build: { outcome: "failed", evidenceLoop: { steps: [{ toolId: "core.run_node", resultCode: "web.action.rejected.blocked_by_dialog", diagnostic }] } } };
  await writeFile(path.join(directory, "snapshots", "flow-lane.json"), JSON.stringify(snapshot));
  const bundle = await readRunBundle(directory);
  assert.deepEqual(bundle.flowLane.build.evidenceLoop.steps[0].diagnostic, diagnostic);
  assert.doesNotMatch(await readFile(path.join(directory, "snapshots", "flow-lane.json"), "utf8"), /https|password|Private|token/u);
});
