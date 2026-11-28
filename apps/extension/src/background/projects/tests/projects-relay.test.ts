// Coverage of projects-relay.ts: list and choose a project through
// Core's `projects` and the per-person context write, with the choice dropped when its
// project is gone and owners never passed on.

import assert from "node:assert/strict";
import test from "node:test";

import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { PanelRelayResponse } from "../../../shared/protocol";
import type { ProjectChoice } from "../choice-storage";
import { relayProjects, type ProjectsRelayContext } from "../projects-relay";

function harness(answers: Record<string, PanelRelayResponse>, chosen?: string) {
  const calls: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];
  const choices: Array<ProjectChoice | null> = [];
  const names: Array<[string, string]> = [];
  let current = chosen;
  const context: ProjectsRelayContext = {
    call: async (endpoint, payload) => {
      calls.push({ endpoint, payload });
      return answers[endpoint] ?? { ok: false, code: "failed", error: "no answer" };
    },
    chosenProject: () => current,
    choose: async (choice) => {
      choices.push(choice);
      current = choice?.projectId;
    },
    noteName: (id, name) => names.push([id, name])
  };
  return { context, calls, choices, names };
}

const projectsAnswer: PanelRelayResponse = {
  ok: true,
  payload: { projects: [{ id: "p1", name: "One", updatedAt: "2026-11-01", ownerUserId: "secret-owner" }, { id: "p2", name: "Two" }, { nope: true }] }
};

test("the message names are the panel's own", () => {
  assert.equal(RUNTIME_MESSAGES.panelListProjects, "fluxiq.panel.listProjects");
  assert.equal(RUNTIME_MESSAGES.panelSelectProject, "fluxiq.panel.selectProject");
  assert.equal(RUNTIME_MESSAGES.panelChanges, "fluxiq.panel.changes");
});

test("listing passes on id, name and updatedAt only, and reports no choice as null", async () => {
  const h = harness({ projects: projectsAnswer });
  const reply = await relayProjects({ type: RUNTIME_MESSAGES.panelListProjects }, h.context);
  assert.deepEqual(reply, { ok: true, projects: [{ id: "p1", name: "One", updatedAt: "2026-11-01" }, { id: "p2", name: "Two" }], selectedProjectId: null });
  assert.deepEqual(h.calls, [{ endpoint: "projects", payload: {} }]);
  assert.deepEqual(h.names, [["p1", "One"], ["p2", "Two"]]);
});

test("listing keeps a choice that still exists", async () => {
  const h = harness({ projects: projectsAnswer }, "p2");
  const reply = await relayProjects({ type: RUNTIME_MESSAGES.panelListProjects }, h.context) as { selectedProjectId: string | null };
  assert.equal(reply.selectedProjectId, "p2");
  assert.deepEqual(h.choices, []);
});

test("listing drops a choice whose project is gone and falls back to Core's", async () => {
  const h = harness({ projects: projectsAnswer }, "gone");
  const reply = await relayProjects({ type: RUNTIME_MESSAGES.panelListProjects }, h.context) as { selectedProjectId: string | null };
  assert.equal(reply.selectedProjectId, null);
  assert.deepEqual(h.choices, [null]);
});

test("Core's refusal comes back as it was, and the choice is untouched", async () => {
  const h = harness({ projects: { ok: false, code: "refused", error: "nope" } }, "p1");
  const reply = await relayProjects({ type: RUNTIME_MESSAGES.panelListProjects }, h.context);
  assert.deepEqual(reply, { ok: false, code: "refused", error: "nope" });
  assert.deepEqual(h.choices, []);
});

test("creating a project is no longer a message: projects are made in the panel or by the first message", async () => {
  assert.equal((RUNTIME_MESSAGES as Record<string, unknown>).panelCreateProject, undefined);
  const h = harness({});
  assert.equal(await relayProjects({ type: "fluxiq.panel.createProject", name: "Nine" }, h.context), undefined);
  assert.deepEqual(h.calls, []);
});

test("a chosen project is written to Core before the browser keeps it", async () => {
  const h = harness({ projects: projectsAnswer });
  const shared: string[] = [];
  const context: ProjectsRelayContext = { ...h.context, shareChoice: async (projectId) => {
      shared.push(projectId);
      return { ok: true, payload: null };
    }
  };
  assert.deepEqual(await relayProjects({ type: RUNTIME_MESSAGES.panelSelectProject, projectId: "p2" }, context), { ok: true });
  assert.deepEqual(shared, ["p2"]);
  assert.deepEqual(h.choices, [{ projectId: "p2", name: "Two" }]);
});

test("Core's 403 is shown as its sentence and the choice is not made", async () => {
  const h = harness({ projects: projectsAnswer });
  const refusal: PanelRelayResponse = { ok: false, code: "refused", httpStatus: 403, error: "This browser is bound to another project." };
  const context: ProjectsRelayContext = { ...h.context, shareChoice: async () => refusal };
  assert.deepEqual(await relayProjects({ type: RUNTIME_MESSAGES.panelSelectProject, projectId: "p2" }, context), refusal);
  assert.deepEqual(h.choices, []);
});

test("an unreachable Core leaves the browser's copy as the choice", async () => {
  const h = harness({ projects: projectsAnswer });
  const context: ProjectsRelayContext = { ...h.context, shareChoice: async () => ({ ok: false, code: "unreachable", error: "FluxIQ could not be reached." }) };
  assert.deepEqual(await relayProjects({ type: RUNTIME_MESSAGES.panelSelectProject, projectId: "p2" }, context), { ok: true });
  assert.deepEqual(h.choices, [{ projectId: "p2", name: "Two" }]);
});

test("choosing a listed project keeps it with its name", async () => {
  const h = harness({ projects: projectsAnswer });
  assert.deepEqual(await relayProjects({ type: RUNTIME_MESSAGES.panelSelectProject, projectId: "p2" }, h.context), { ok: true });
  assert.deepEqual(h.choices, [{ projectId: "p2", name: "Two" }]);
});

test("choosing an unknown project is refused and changes nothing", async () => {
  const h = harness({ projects: projectsAnswer });
  const reply = await relayProjects({ type: RUNTIME_MESSAGES.panelSelectProject, projectId: "zzz" }, h.context) as { ok: boolean };
  assert.equal(reply.ok, false);
  assert.deepEqual(h.choices, []);
});

test("null follows Core without asking Core anything", async () => {
  const h = harness({}, "p1");
  assert.deepEqual(await relayProjects({ type: RUNTIME_MESSAGES.panelSelectProject, projectId: null }, h.context), { ok: true });
  assert.deepEqual(h.choices, [null]);
  assert.deepEqual(h.calls, []);
});

test("another message type is not this relay's", async () => {
  assert.equal(await relayProjects({ type: "fluxiq.getStatus" }, harness({}).context), undefined);
});
