import assert from "node:assert/strict";
import { test } from "node:test";
import type { PlatformHookPayloads } from "fluxiq/platform/panel";
import { DEFAULT_PROJECT_NAME, seedDefaultProject } from "../index.ts";

type Project = { id: string; name: string };

/** An in-memory stand-in for the workspace's Automation Studio service: only the two calls the hook makes. */
function fakeWorkspace(existing: Project[] = []) {
  const projects = [...existing];
  const created: Array<{ name: unknown }> = [];
  const studio = {
    async listProjects() {
      return { categories: [], projects: [...projects] };
    },
    async createProject(input: { name: unknown }) {
      created.push(input);
      const project = { id: `project-${projects.length + 1}`, name: String(input.name) };
      projects.unshift(project);
      return project;
    }
  };
  const payload = { accountId: "acct-1", workspaceId: "ws-1", ownerUserId: "user-1", fluxiq: { programs: { automationStudio: studio } } } as unknown as PlatformHookPayloads["workspace.created"];
  return { payload, projects, created };
}

test("creates the default project once", async () => {
  const workspace = fakeWorkspace();
  await seedDefaultProject(workspace.payload);
  assert.deepEqual(workspace.created, [{ name: "My automations" }]);
  assert.deepEqual(workspace.projects.map((project) => project.name), [DEFAULT_PROJECT_NAME]);
});

test("a second event creates nothing", async () => {
  const workspace = fakeWorkspace();
  await seedDefaultProject(workspace.payload);
  await seedDefaultProject(workspace.payload);
  assert.equal(workspace.created.length, 1);
  assert.equal(workspace.projects.length, 1);
});

test("an existing project of that name is left alone, others do not block", async () => {
  const named = fakeWorkspace([{ id: "p0", name: DEFAULT_PROJECT_NAME }]);
  await seedDefaultProject(named.payload);
  assert.equal(named.created.length, 0);
  const other = fakeWorkspace([{ id: "p0", name: "Something else" }]);
  await seedDefaultProject(other.payload);
  assert.equal(other.created.length, 1);
});

test("a failure propagates instead of being swallowed", async () => {
  const workspace = fakeWorkspace();
  (workspace.payload.fluxiq.programs.automationStudio as unknown as { createProject: () => Promise<never> }).createProject = async () => {
    throw new Error("storage unavailable");
  };
  await assert.rejects(seedDefaultProject(workspace.payload), /storage unavailable/u);
});
