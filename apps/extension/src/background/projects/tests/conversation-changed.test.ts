// Coverage of conversation-changed.ts and resync-changes.ts: what the panel is told for a changed chat and for a ready session.

import assert from "node:assert/strict";
import test from "node:test";

import { conversationChangedFor } from "../conversation-changed";
import { resyncChange } from "../resync-changes";

test("a changed conversation names itself and its project; the panel's own thread has no project", () => {
  assert.deepEqual(conversationChangedFor({ conversationId: "c1", projectId: "p1" }, 5), { type: "fluxiq.panel.changes", projectId: "p1", conversationIds: ["c1"], at: 5 });
  assert.deepEqual(conversationChangedFor({ conversationId: "c2", projectId: null }, 6), { type: "fluxiq.panel.changes", projectId: null, conversationIds: ["c2"], at: 6 });
});

test("a payload naming no conversation pushes nothing", () => {
  assert.equal(conversationChangedFor({ projectId: "p1" }, 1), undefined);
  assert.equal(conversationChangedFor({ conversationId: "" }, 1), undefined);
  assert.equal(conversationChangedFor(null, 1), undefined);
});

test("a resync names no conversation", () => {
  assert.deepEqual(resyncChange(9), { type: "fluxiq.panel.changes", projectId: null, at: 9 });
});
