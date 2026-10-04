import assert from "node:assert/strict";
import test from "node:test";
import { navigateChatProject } from "../driver.js";

const READY = { projectId: "project.new", scopeState: "ready", composerAvailable: true, composerEnabled: true };

test("only a successful rendered scope can follow navigation; loading transitions to empty-ready", async () => {
  const order: string[] = [];
  let reads = 0;
  const result = await navigateChatProject("project.new", async () => { order.push("navigate"); }, async () => {
    order.push("read");
    return ++reads === 1 ? { ...READY, scopeState: "loading" } : READY;
  }, 1000);
  assert.equal(result.scopeState, "ready");
  assert.deepEqual(order, ["navigate", "read", "read"]);
});

test("mismatch, error, absent receiver and malformed scope fail closed without retries or sends", async () => {
  for (const value of [undefined, { ...READY, projectId: "project.old" }, { ...READY, scopeState: "error" }, { ...READY, scopeState: null }]) {
    await assert.rejects(navigateChatProject("project.new", async () => undefined, async () => value, 100), /unavailable|match|error|not ready/);
  }
});

test("never-ready and late read responses cannot outlive the setup deadline", async () => {
  await assert.rejects(navigateChatProject("project.new", async () => undefined, async () => ({ ...READY, scopeState: "loading" }), 10), /Timed out/);
  await assert.rejects(navigateChatProject("project.new", async () => undefined, () => new Promise(resolve => setTimeout(() => resolve(READY), 30)), 10), /Timed out/);
});

test("invalid project identifiers never reach the mounted receiver", async () => {
  let called = false;
  for (const id of ["", " ", " project.new", "project. new", "x".repeat(257)]) {
    await assert.rejects(navigateChatProject(id, async () => { called = true; }, async () => READY), /identifier/);
  }
  assert.equal(called, false);
});
