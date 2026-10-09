// Coverage of headline.ts: what a unit of work is called while it works and
// how it settles, by its kind and situation.

import assert from "node:assert/strict";
import test from "node:test";

import { activityHeadline } from "../headline";

test("a terminal cancellation says stopped rather than failed or ready", () => {
  assert.equal(activityHeadline("build", "failed", { stopped: true }), "Build stopped");
  assert.equal(activityHeadline("run", "failed", { stopped: true }), "Run stopped");
});

test("a run's recovery that fails reads \"Couldn't fix your Flow\"", () => {
  assert.equal(activityHeadline("run", null, { repairing: true }), "Fixing your Flow");
  assert.equal(activityHeadline("run", "failed", { repairing: true }), "Couldn't fix your Flow");
  assert.equal(activityHeadline("run", "failed"), "Run failed");
});

// t195 `run-musp474o-e0ed7432` (12-failure-scenario): a creation build ended
// unfinished during its repair rounds and the overlay said "Couldn't fix your
// Flow", though no Flow existed to fix. A build's repair re-authors the Flow
// the build is making; when the build fails, the build failed.
test("a build that fails while it repairs settles on the build's own failure headline", () => {
  assert.equal(activityHeadline("build", null, { repairing: true }), "Fixing your Flow");
  assert.equal(activityHeadline("build", "failed", { repairing: true }), "Build failed");
  assert.equal(activityHeadline("build", "failed"), "Build failed");
});

test("a run held for the person reads 'Paused: your turn on the page'", () => {
  assert.equal(activityHeadline("run", "waiting", { waitingOn: "paused" }), "Paused: your turn on the page");
  assert.equal(activityHeadline("run", "waiting", { waitingOn: "check" }), "Waiting for you: finish the check on the page");
});
