import assert from "node:assert/strict";
import test from "node:test";
import { assertCreationProjectReady } from "../readiness.js";

test("new topology alone is insufficient: stale extension project cannot precede Send", async () => {
  let sent = false;
  await assert.rejects(async () => {
    await assertCreationProjectReady("project.new", async () => {
      return { projectId: "project.old", scopeState: "ready", composerAvailable: true, composerEnabled: true, unrelatedPrivateField: "synthetic" };
    });
    sent = true;
  }, /not ready/);
  assert.equal(sent, false);
});

test("authorized rendered empty-ready project permits Send and readiness timeout preserves failure", async () => {
  await assertCreationProjectReady("project.new", async () => {
    return { projectId: "project.new", scopeState: "ready", composerAvailable: true, composerEnabled: true };
  });
  await assert.rejects(assertCreationProjectReady("project.new", async () => { throw new Error("synthetic timeout"); }), /timeout/);
});

test("matching requested ID without a successful read or available composer cannot precede Send", async () => {
  for (const override of [{ scopeState: "loading" }, { scopeState: "error" }, { composerAvailable: false }, { composerEnabled: false }]) {
    await assert.rejects(assertCreationProjectReady("project.new", async () => ({ projectId: "project.new", scopeState: "ready", composerAvailable: true, composerEnabled: true, ...override })), /not ready/);
  }
});

test("recording/session project equality cannot stand in for an authorized rendered chat read", async () => {
  await assert.rejects(assertCreationProjectReady("project.new", async () => ({ projectId: "project.new" })), /not ready/);
});
