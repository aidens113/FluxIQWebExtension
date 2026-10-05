import assert from "node:assert/strict";
import test from "node:test";
import { selectReplayProject } from "../project-selection.js";

function fixture() {
  const calls: string[] = [];
  const control = {
    async selectExistingContext(id: string) { calls.push(`select:${id}`); },
    async listFlowSummaries(id: string) { calls.push(`list:${id}`); return id === "project.new" ? [{ flowId: "flow.saved" }] : [{ flowId: "flow.legacy" }]; },
  };
  return { calls, control };
}

test("explicit project binds before lookup and never reads workspace default", async () => {
  const f = fixture();
  assert.equal(await selectReplayProject(f.control, { defaultProjectId: "project.default", projectId: "project.new", flowId: "flow.saved" }), "project.new");
  assert.deepEqual(f.calls, ["select:project.new", "list:project.new"]);
});

test("mismatched explicit project cannot find Flow in legacy default", async () => {
  const f = fixture();
  await assert.rejects(selectReplayProject(f.control, { defaultProjectId: "project.default", projectId: "project.new", flowId: "flow.legacy" }), /no matching/);
  assert.deepEqual(f.calls, ["select:project.new", "list:project.new"]);
});

test("absent override retains default and empty override is refused before control", async () => {
  const f = fixture();
  assert.equal(await selectReplayProject(f.control, { defaultProjectId: "project.default", flowId: "flow.legacy" }), "project.default");
  f.calls.length = 0;
  await assert.rejects(selectReplayProject(f.control, { defaultProjectId: "project.default", projectId: "  ", flowId: "flow.legacy" }), /project/);
  assert.deepEqual(f.calls, []);
});
