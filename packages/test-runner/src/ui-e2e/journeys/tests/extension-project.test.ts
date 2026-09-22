// When the extension is on a project other than the journey's, so its
// session must be reset before it can record.

import assert from "node:assert/strict";
import test from "node:test";
import { staleProject } from "../extension-project.js";

test("only a different, reported project is stale; none yet resolves the panel's at recording start", () => {
  assert.equal(staleProject("project.other", "project.one"), true);
  assert.equal(staleProject("project.one", "project.one"), false);
  assert.equal(staleProject(undefined, "project.one"), false);
  assert.equal(staleProject("", "project.one"), false);
});
