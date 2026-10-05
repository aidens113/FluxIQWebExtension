import assert from "node:assert/strict";
import test from "node:test";
import { replayKeyIdentities, replayKeyPreservation } from "../index.js";

test("replay reads every key identity without revealing, deleting or authorizing any key", async () => {
  const endpoints: string[] = [];
  const keys = [{ id: "fixture.model", kind: "llm" }, { id: "fixture.api", kind: "api" }];
  const control = { async secretKeysCall(endpoint: string, payload: Record<string, unknown>) {
    endpoints.push(endpoint); assert.deepEqual(payload, {});
    assert.equal(endpoint, "snapshot"); return { keys };
  } };
  const before = await replayKeyIdentities(control);
  keys.reverse();
  const after = await replayKeyIdentities(control);
  assert.deepEqual(replayKeyPreservation(before, after), { before: 2, after: 2, preserved: true });
  assert.deepEqual(endpoints, ["snapshot", "snapshot"]);
  assert.equal(Object.isFrozen(before), true);
});

test("same counts cannot conceal removal, replacement or changed key kinds", () => {
  for (const after of [["new"], [], ["old", "added"]]) assert.equal(replayKeyPreservation(["old"], after).preserved, false);
  assert.deepEqual(replayKeyPreservation([], []), { before: 0, after: 0, preserved: true });
});

test("unreadable or duplicate stored identities refuse without issuing mutation calls", async () => {
  for (const snapshot of [{ items: [] }, { keys: [null] }, { keys: [{ id: "x" }] },
    { keys: [{ id: "x", kind: "llm" }, { id: "x", kind: "api" }] }, { keys: [{ id: " ", kind: "llm" }] }]) {
    const endpoints: string[] = [];
    await assert.rejects(replayKeyIdentities({ async secretKeysCall(endpoint: string) { endpoints.push(endpoint); return snapshot; } }), /unreadable/);
    assert.deepEqual(endpoints, ["snapshot"]);
  }
});
