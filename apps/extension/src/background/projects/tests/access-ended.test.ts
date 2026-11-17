// Coverage of access-ended.ts: Core's `server.project_access_ended` is read as
// the lost project, where Core moved the session (null: none) and Core's reason,
// with a plain reason of its own when Core sent none, and nothing at all when it
// names no project.

import assert from "node:assert/strict";
import test from "node:test";

import { projectAccessEnded } from "../access-ended";

test("reads the lost project, the session's new project and Core's reason", () => {
  assert.deepEqual(projectAccessEnded({ projectId: "project-1", currentProjectId: "project-2", message: "Core's words." }), { projectId: "project-1", currentProjectId: "project-2", message: "Core's words." });
  assert.deepEqual(projectAccessEnded({ projectId: "project-1", currentProjectId: null, message: "Core's words." }), { projectId: "project-1", currentProjectId: null, message: "Core's words." });
});

test("reads a missing or blank new project as none, and gives a reason when Core sent none", () => {
  const notice = projectAccessEnded({ projectId: "project-1", currentProjectId: "  " });
  assert.equal(notice?.currentProjectId, null);
  assert.match(notice?.message ?? "", /can no longer open it/);
});

test("is nothing when no project is named", () => {
  assert.equal(projectAccessEnded({ currentProjectId: "project-2", message: "x" }), undefined);
  assert.equal(projectAccessEnded({ projectId: "   " }), undefined);
  assert.equal(projectAccessEnded(null), undefined);
});
