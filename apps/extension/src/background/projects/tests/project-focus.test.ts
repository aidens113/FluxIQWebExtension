// Coverage of project-focus.ts and focus-refusal.ts: the person's project choice
// reaches Core as `client.focus_project` on choose, on clear and on every ready
// session while a choice is held; never queued while offline; and Core's refusal
// is read as being about the project, not the connection.

import assert from "node:assert/strict";
import test from "node:test";

import { projectFocusRefusal } from "../focus-refusal";
import { ProjectFocus } from "../project-focus";

function harness(input: { connected?: boolean; chosen?: string; failing?: boolean } = {}) {
  const state = { connected: input.connected ?? true, chosen: input.chosen, sent: [] as Array<{ type: string; payload: unknown }>, failures: [] as unknown[] };
  const focus = new ProjectFocus({
    send: async (type, payload) => {
      if (input.failing) throw new Error("socket closed");
      state.sent.push({ type, payload });
    },
    connected: () => state.connected,
    chosenProject: () => state.chosen,
    onSendFailed: (error) => void state.failures.push(error)
  });
  return { focus, state };
}

test("choosing a project tells Core at once, and clearing the choice sends null", async () => {
  const h = harness();
  await h.focus.chosen("project-2");
  await h.focus.chosen(null);
  assert.deepEqual(h.state.sent, [
    { type: "client.focus_project", payload: { projectId: "project-2" } },
    { type: "client.focus_project", payload: { projectId: null } }
  ]);
});

test("a ready session is told the held choice, and nothing when the browser follows Core", async () => {
  const h = harness({ chosen: "project-2" });
  await h.focus.announceHeld();
  h.state.chosen = undefined;
  await h.focus.announceHeld();
  assert.deepEqual(h.state.sent, [{ type: "client.focus_project", payload: { projectId: "project-2" } }]);
});

test("nothing is sent, or queued, while the session is not ready; the next ready session carries the choice", async () => {
  const h = harness({ connected: false, chosen: "project-2" });
  await h.focus.chosen("project-2");
  await h.focus.announceHeld();
  assert.deepEqual(h.state.sent, []);
  h.state.connected = true;
  await h.focus.announceHeld();
  assert.deepEqual(h.state.sent, [{ type: "client.focus_project", payload: { projectId: "project-2" } }]);
});

test("a failed send is reported and never thrown at the caller", async () => {
  const h = harness({ failing: true });
  await h.focus.chosen("project-2");
  assert.equal(h.state.failures.length, 1);
});

test("a project_focus refusal is read with its code, words and project; every other error is not one", () => {
  assert.deepEqual(
    projectFocusRefusal({ code: "project_focus.refused", message: "The person who paired this browser cannot open that project here.", metadata: { projectId: "project-9" } }),
    { code: "project_focus.refused", message: "The person who paired this browser cannot open that project here.", projectId: "project-9" }
  );
  assert.deepEqual(projectFocusRefusal({ code: "project_focus.unavailable", message: "Try again." }), { code: "project_focus.unavailable", message: "Try again." });
  assert.equal(projectFocusRefusal({ code: "recording.project_required", message: "Open a project first." }), undefined);
  assert.equal(projectFocusRefusal({ message: "no code" }), undefined);
  assert.equal(projectFocusRefusal(undefined), undefined);
});
