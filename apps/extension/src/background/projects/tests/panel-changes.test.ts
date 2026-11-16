// Coverage of panel-changes.ts: a Core activity push becomes one panelChanges message.

import assert from "node:assert/strict";
import test from "node:test";

import { panelChangesFor } from "../panel-changes";

test("an activity with a project and a conversation names both", () => {
  assert.deepEqual(
    panelChangesFor({ subject: { kind: "run", id: "r", projectId: "p1" }, conversationId: "c1" }, 5),
    { type: "fluxiq.panel.changes", projectId: "p1", conversationIds: ["c1"], at: 5 }
  );
});

test("an activity with only a project names no conversation", () => {
  assert.deepEqual(panelChangesFor({ subject: { projectId: "p1" } }, 7), { type: "fluxiq.panel.changes", projectId: "p1", at: 7 });
});

test("an activity naming neither, or not an object, pushes nothing", () => {
  assert.equal(panelChangesFor({ subject: {} }, 1), undefined);
  assert.equal(panelChangesFor("x", 1), undefined);
  assert.equal(panelChangesFor(null, 1), undefined);
});
