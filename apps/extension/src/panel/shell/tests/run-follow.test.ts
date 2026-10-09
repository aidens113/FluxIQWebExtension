import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewayActivity } from "../../../shared/activity/index";
import { createRunFollow, type RunFollowInput } from "../run-follow";

function event(kind: "run" | "build", id: string, fields: Partial<ClientGatewayActivity> = {}, projectId = "p"): ClientGatewayActivity {
  return { activityId: `${kind}:${id}`, sequence: 1, subject: { kind, id, projectId, flowId: "f" }, phase: "running", label: "Running", at: "2026-10-08T00:00:00.000Z", ...fields };
}

const quiet: Omit<RunFollowInput, "current"> = { projectId: "p", recording: false, typing: false };

test("a new run of the chosen project switches once, on its first event only", () => {
  const follow = createRunFollow();
  assert.equal(follow.observe({ ...quiet, current: event("run", "r1") }), true);
  assert.equal(follow.observe({ ...quiet, current: event("run", "r1", { sequence: 2 }) }), false);
  assert.equal(follow.observe({ ...quiet, current: event("run", "r1", { sequence: 3, final: true }) }), false);
  assert.equal(follow.observe({ ...quiet, current: event("run", "r2") }), true, "the next run is followed again");
});

test("builds, nothing, another project's run and an already finished run never switch", () => {
  const follow = createRunFollow();
  assert.equal(follow.observe({ ...quiet, current: null }), false);
  assert.equal(follow.observe({ ...quiet, current: event("build", "f") }), false);
  assert.equal(follow.observe({ ...quiet, current: event("run", "other", {}, "q") }), false);
  assert.equal(follow.observe({ ...quiet, current: event("run", "ended", { final: true }) }), false);
  assert.equal(follow.observe({ ...quiet, projectId: undefined, current: event("run", "any", {}, "q") }), true, "no chosen project follows any run");
});

test("a run that starts during a recording is left alone for good", () => {
  const follow = createRunFollow();
  assert.equal(follow.observe({ ...quiet, recording: true, current: event("run", "r") }), false);
  assert.equal(follow.observe({ ...quiet, current: event("run", "r", { sequence: 2 }) }), false, "the recording ending does not pull the panel to the run");
});

test("typing in a field the switch would hide waits, then switches once on a later event", () => {
  const follow = createRunFollow();
  assert.equal(follow.observe({ ...quiet, typing: true, current: event("run", "r") }), false);
  assert.equal(follow.observe({ ...quiet, typing: true, current: event("run", "r", { sequence: 2 }) }), false);
  assert.equal(follow.observe({ ...quiet, current: event("run", "r", { sequence: 3 }) }), true);
  assert.equal(follow.observe({ ...quiet, current: event("run", "r", { sequence: 4 }) }), false);
});

test("a waiting switch is dropped when the run ends, a recording starts, or other work takes over", () => {
  for (const next of [
    { ...quiet, current: event("run", "r", { sequence: 2, final: true }) },
    { ...quiet, recording: true, current: event("run", "r", { sequence: 2 }) },
    { ...quiet, current: event("build", "f") }
  ]) {
    const follow = createRunFollow();
    assert.equal(follow.observe({ ...quiet, typing: true, current: event("run", "r") }), false);
    assert.equal(follow.observe(next), false);
    assert.equal(follow.observe({ ...quiet, current: event("run", "r", { sequence: 5 }) }), false);
  }
});
