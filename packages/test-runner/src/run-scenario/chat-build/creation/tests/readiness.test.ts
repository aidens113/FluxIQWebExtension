import assert from "node:assert/strict";
import test from "node:test";
import { assertCreationProjectReady } from "../readiness.js";

test("new topology alone is insufficient: stale extension project cannot precede Send", async () => {
  let sent = false;
  await assert.rejects(async () => {
    await assertCreationProjectReady("project.new", async matches => {
      assert.equal(matches({ projectId: "project.old" }), false);
      return { projectId: "project.old", unrelatedPrivateField: "synthetic" };
    });
    sent = true;
  }, /not ready/);
  assert.equal(sent, false);
});

test("matching extension project permits Send and readiness timeout preserves failure", async () => {
  await assertCreationProjectReady("project.new", async matches => {
    assert.equal(matches(undefined), false);
    assert.equal(matches({ projectId: "project.new" }), true);
    return { projectId: "project.new" };
  });
  await assert.rejects(assertCreationProjectReady("project.new", async () => { throw new Error("synthetic timeout"); }), /timeout/);
});
