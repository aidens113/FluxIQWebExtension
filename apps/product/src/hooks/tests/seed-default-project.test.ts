import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_PROJECT_NAME, seedDefaultProject } from "../index.ts";
import { createSeedWorkspace } from "./seed-workspace.ts";

test("assigns the real provisioned user and enforces service IAM ownership", async (context) => {
  const workspace = await createSeedWorkspace(context);
  await seedDefaultProject(workspace.payload);
  const projects = await workspace.projects();
  assert.equal(projects.length, 1);
  assert.equal(projects[0]?.name, DEFAULT_PROJECT_NAME);
  assert.equal(projects[0]?.ownerUserId, workspace.owner.userId);
  assert.notEqual(projects[0]?.ownerUserId, workspace.fallbackAdmin.id);
  assert.equal((await workspace.readProject(projects[0]!.id)).ok, true);
  assert.equal((await workspace.readProject(projects[0]!.id, workspace.other.actor)).errorCode, "authorization.forbidden");
  assert.deepEqual(await workspace.projects(workspace.other.actor), []);
});

test("repeated and simultaneous events create one owned seed", async (context) => {
  const workspace = await createSeedWorkspace(context);
  await Promise.all([seedDefaultProject(workspace.payload), seedDefaultProject(workspace.payload)]);
  const first = await workspace.projects();
  await seedDefaultProject(workspace.payload);
  assert.equal(first.length, 1);
  assert.deepEqual(await workspace.projects(), first);
  assert.equal((await workspace.studio.listProjects()).projects.length, 1);
});

test("repairs an incomplete seed without duplicating its project or keeping the fallback admin", async (context) => {
  const workspace = await createSeedWorkspace(context);
  const original = await workspace.studio.createProject({ name: DEFAULT_PROJECT_NAME });
  assert.deepEqual(await workspace.projects(), []);
  await seedDefaultProject(workspace.payload);
  const projects = await workspace.projects();
  assert.deepEqual(projects.map((project) => [project.id, project.ownerUserId]), [[original.id, workspace.owner.userId]]);
  assert.equal((await workspace.studio.listProjects()).projects.length, 1);
});

test("keeps an existing same-owner seed and unrelated projects", async (context) => {
  const workspace = await createSeedWorkspace(context);
  const original = await workspace.createOwnedProject(DEFAULT_PROJECT_NAME);
  const unrelated = await workspace.createOwnedProject("Other work");
  await seedDefaultProject(workspace.payload);
  assert.deepEqual((await workspace.projects()).map((project) => project.id).sort(), [original.id, unrelated.id].sort());
});

test("refuses a different recorded creator without taking or duplicating their project", async (context) => {
  const workspace = await createSeedWorkspace(context);
  const original = await workspace.createOwnedProject(DEFAULT_PROJECT_NAME, workspace.other.actor);
  await assert.rejects(seedDefaultProject(workspace.payload), /already has a recorded creator/u);
  assert.deepEqual(await workspace.projects(), []);
  const projects = await workspace.projects(workspace.other.actor);
  assert.deepEqual(projects.map((project) => [project.id, project.ownerUserId]), [[original.id, workspace.other.userId]]);
  assert.equal((await workspace.studio.listProjects()).projects.length, 1);
});

test("refuses ambiguous existing seed names without changing either project", async (context) => {
  const workspace = await createSeedWorkspace(context);
  await workspace.createOwnedProject(DEFAULT_PROJECT_NAME);
  await workspace.createOwnedProject(DEFAULT_PROJECT_NAME, workspace.other.actor);
  await assert.rejects(seedDefaultProject(workspace.payload), /more than one/u);
  assert.equal((await workspace.projects()).length, 1);
  assert.equal((await workspace.projects(workspace.other.actor)).length, 1);
  assert.equal((await workspace.studio.listProjects()).projects.length, 2);
});

test("propagates a creation failure", async (context) => {
  const workspace = await createSeedWorkspace(context);
  context.mock.method(workspace.studio, "createProject", async () => {
    throw new Error("storage unavailable");
  });
  await assert.rejects(seedDefaultProject(workspace.payload), /storage unavailable/u);
  assert.equal((await workspace.studio.listProjects()).projects.length, 0);
});

test("retries ownership after creation failed partway through", async (context) => {
  const workspace = await createSeedWorkspace(context);
  const failingCatalog = context.mock.method(workspace.studio, "assertProjectDomainAccess", async () => {
    throw new Error("ownership catalog unavailable");
  });
  await assert.rejects(seedDefaultProject(workspace.payload), /ownership catalog unavailable/u);
  const incomplete = (await workspace.studio.listProjects()).projects;
  assert.equal(incomplete.length, 1);
  failingCatalog.mock.restore();
  await seedDefaultProject(workspace.payload);
  assert.deepEqual((await workspace.projects()).map((project) => [project.id, project.ownerUserId]), [[incomplete[0]!.id, workspace.owner.userId]]);
  assert.equal((await workspace.studio.listProjects()).projects.length, 1);
});

test("refuses an empty owner before creating a project", async (context) => {
  const workspace = await createSeedWorkspace(context);
  await assert.rejects(seedDefaultProject({ ...workspace.payload, ownerUserId: " " }), /owner/u);
  assert.equal((await workspace.studio.listProjects()).projects.length, 0);
});

test("concurrent different owners retain their own success and conflict", async (context) => {
  const workspace = await createSeedWorkspace(context);
  const results = await Promise.allSettled([
    seedDefaultProject(workspace.payload),
    seedDefaultProject({ ...workspace.payload, ownerUserId: workspace.other.userId })
  ]);
  assert.equal(results[0]?.status, "fulfilled");
  assert.equal(results[1]?.status, "rejected");
  if (results[1]?.status === "rejected") assert.match(String(results[1].reason), /already has a recorded creator/u);
  assert.deepEqual((await workspace.projects()).map((project) => project.ownerUserId), [workspace.owner.userId]);
  assert.equal((await workspace.studio.listProjects()).projects.length, 1);
  await seedDefaultProject(workspace.payload);
  assert.equal((await workspace.projects()).length, 1);
});

test("a queued repair succeeds without hiding the original caller's failure", async (context) => {
  const workspace = await createSeedWorkspace(context);
  const original = workspace.studio.assertProjectDomainAccess.bind(workspace.studio);
  let attempts = 0;
  context.mock.method(workspace.studio, "assertProjectDomainAccess", async (...args: Parameters<typeof original>) => {
    attempts += 1;
    if (attempts === 1) throw new Error("first ownership attempt failed");
    return original(...args);
  });
  const results = await Promise.allSettled([seedDefaultProject(workspace.payload), seedDefaultProject(workspace.payload)]);
  assert.equal(results[0]?.status, "rejected");
  if (results[0]?.status === "rejected") assert.match(String(results[0].reason), /first ownership attempt failed/u);
  assert.equal(results[1]?.status, "fulfilled");
  assert.deepEqual((await workspace.projects()).map((project) => project.ownerUserId), [workspace.owner.userId]);
  assert.equal((await workspace.studio.listProjects()).projects.length, 1);
});
