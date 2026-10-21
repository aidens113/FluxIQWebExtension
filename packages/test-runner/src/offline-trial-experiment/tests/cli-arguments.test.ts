import assert from "node:assert/strict";
import test from "node:test";
import { parseExperimentArguments } from "../cli-arguments.js";

const base = ["--store", "s", "--project", "p", "--steps", "d"];

test("survey takes the store, project and steps, and the social task's defaults", () => {
  const parsed = parseExperimentArguments(["survey", ...base]);
  assert.ok(!("error" in parsed));
  assert.deepEqual([parsed.command, parsed.scenario, parsed.task, parsed.brief, parsed.fromRevision, parsed.out], ["survey", "social-network-feed", "social-network-feed-recent-group-posts", "brief-1", 10, null]);
});

test("trial needs a source trace and exactly one candidate", () => {
  assert.match((parseExperimentArguments(["trial", ...base, "--revision", "10"]) as { error: string }).error, /--trace/);
  assert.match((parseExperimentArguments(["trial", ...base, "--trace", "t"]) as { error: string }).error, /exactly one candidate/);
  assert.match((parseExperimentArguments(["trial", ...base, "--trace", "t", "--revision", "10", "--process", "p.json"]) as { error: string }).error, /exactly one candidate/);
  const revision = parseExperimentArguments(["trial", ...base, "--trace", "t", "--revision", "16"]);
  assert.ok(!("error" in revision));
  assert.equal(revision.revision, 16);
  const correction = parseExperimentArguments(["trial", ...base, "--trace", "t", "--process", "p.json", "--step-label", "rows"]);
  assert.ok(!("error" in correction));
  assert.deepEqual([correction.process, correction.stepLabel, correction.revision], ["p.json", "rows", null]);
});

test("trial runs in a new work directory under test-runs, supplying the declared session view or none", () => {
  const run = parseExperimentArguments(["trial", ...base, "--trace", "t", "--revision", "10", "--work", "test-runs/p4d-run/e1", "--session-view", "declared"]);
  assert.ok(!("error" in run));
  assert.deepEqual([run.work, run.sessionView], ["test-runs/p4d-run/e1", "declared"]);
  const prepared = parseExperimentArguments(["trial", ...base, "--trace", "t", "--revision", "10"]);
  assert.ok(!("error" in prepared));
  assert.deepEqual([prepared.work, prepared.sessionView], [null, "none"]);
  const none = parseExperimentArguments(["trial", ...base, "--trace", "t", "--revision", "10", "--session-view", "none"]);
  assert.ok(!("error" in none));
  assert.equal(none.sessionView, "none");
  assert.match((parseExperimentArguments(["trial", ...base, "--trace", "t", "--revision", "10", "--work", "elsewhere/e1"]) as { error: string }).error, /test-runs/);
  assert.match((parseExperimentArguments(["trial", ...base, "--trace", "t", "--revision", "10", "--session-view", "trace"]) as { error: string }).error, /declared or none/);
  assert.match((parseExperimentArguments(["survey", ...base, "--work", "test-runs/x"]) as { error: string }).error, /trial arguments/);
  assert.match((parseExperimentArguments(["trial", ...base, "--trace", "t", "--revision", "10", "--runner", "x"]) as { error: string }).error, /--runner is not an argument/);
});

test("refuses an unknown command, an unknown argument, a missing value and a number that is not whole", () => {
  assert.ok("error" in parseExperimentArguments(["run", ...base]));
  assert.match((parseExperimentArguments(["survey", ...base, "--model", "x"]) as { error: string }).error, /--model is not an argument/);
  assert.match((parseExperimentArguments(["survey", "--store"]) as { error: string }).error, /--store needs a value/);
  assert.match((parseExperimentArguments(["survey", ...base, "--from-revision", "ten"]) as { error: string }).error, /whole number/);
  assert.match((parseExperimentArguments(["survey", "--store", "s"]) as { error: string }).error, /--project is required/);
});
