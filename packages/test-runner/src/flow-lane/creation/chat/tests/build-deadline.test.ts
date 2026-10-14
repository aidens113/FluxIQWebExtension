import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_PROJECT_BUILD_MAX_DURATION_MS } from "fluxiq/automation-studio";
import { createdFlowChatBuildDeadlineMs } from "../build-deadline.js";

// A8 launch 7 lost three of four project builds to the chat's deadline, sized
// for one candidate loop (t592). A project build's deadline is Core's bound on
// it plus the chat's steps around it, so a Core that changes its bound moves
// the Lab's with it; a candidate build's stays what it was.

test("a project build's chat deadline is Core's project build bound plus the chat's steps around it", () => {
  assert.equal(createdFlowChatBuildDeadlineMs("project"), 60_000 + AUTOMATION_STUDIO_PROJECT_BUILD_MAX_DURATION_MS + 15_000 + 120_000);
  assert.equal(AUTOMATION_STUDIO_PROJECT_BUILD_MAX_DURATION_MS, 1_800_000, "Core's bound is thirty minutes");
});

test("a candidate or legacy build's chat deadline is unchanged", () => {
  assert.equal(createdFlowChatBuildDeadlineMs("candidate"), 60_000 + 600_000 + 15_000 + 120_000);
  assert.equal(createdFlowChatBuildDeadlineMs("legacy"), 795_000);
});
