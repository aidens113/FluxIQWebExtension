import assert from "node:assert/strict";
import test from "node:test";
import { pendingCloneDestination } from "../pending-clone-destination.js";

const source = { projectId: "project.source", flowId: "flow.source", origin: "https://source.example.test" };

test("the same run exporting the same source derives the same ids, so the export cache hits", () => {
  assert.deepEqual(pendingCloneDestination("run-abc", source), pendingCloneDestination("run-abc", source));
  const { projectId, flowId } = pendingCloneDestination("run-abc", source);
  assert.match(projectId, /^project\.clone\.pending\.[0-9a-f]{24}$/u);
  assert.match(flowId, /^flow\.clone\.pending\.[0-9a-f]{24}$/u);
  assert.equal(projectId.slice(-24), flowId.slice(-24), "one suffix addresses both, so a package is one destination rather than two");
});

test("another run, or another source in the same run, can never derive the same ids", () => {
  const mine = pendingCloneDestination("run-abc", source).projectId;
  assert.notEqual(pendingCloneDestination("run-def", source).projectId, mine, "another run's pending package cannot be mistaken for this one's");
  assert.notEqual(pendingCloneDestination("run-abc", { ...source, flowId: "flow.other" }).projectId, mine);
  assert.notEqual(pendingCloneDestination("run-abc", { ...source, projectId: "project.other" }).projectId, mine);
});

/**
 * The parts are joined with a NUL, which no id may contain, so no two different
 * combinations of ids can be spelled the same way. Concatenated plainly,
 * `("a", "bc")` and `("ab", "c")` would hash alike.
 */
test("no two different combinations of run and source ids collide through their spelling", () => {
  const first = pendingCloneDestination("run", { ...source, projectId: "a", flowId: "bc" }).projectId;
  const second = pendingCloneDestination("run", { ...source, projectId: "ab", flowId: "c" }).projectId;
  assert.notEqual(first, second);
});
