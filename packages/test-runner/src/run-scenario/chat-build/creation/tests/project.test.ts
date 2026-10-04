import assert from "node:assert/strict";
import test from "node:test";
import { prepareIndependentCreationProject } from "../project.js";
import type { CreationContext } from "../context.js";

function fixture() {
  const events: string[] = [];
  const oldProject = { flow: "old unfinished draft", conversation: ["old task", "old failure"] };
  const control = {
    async createProject(input: { name: string; description: string; domainId: string; authorizationPin?: string }) { assert.deepEqual(input, { name: "Creation run.new", description: "Run-owned independent creation project", domainId: "web-automation", authorizationPin: "synthetic" }); events.push("create"); return "project.new"; },
    async selectExistingContext(id: string) { events.push(`select:${id}`); },
  };
  let identity: CreationContext | undefined;
  const input = { independent: true, runId: "run.new", workspace: "test-workspace", domainId: "web-automation", async writeIdentity(value: CreationContext) { identity = value; events.push("identity"); } };
  return { topology: { projectId: "project.old", control, authorizationPin: "synthetic", oldProject }, input, events, identity: () => identity };
}

test("independent creation replaces scope before browser/chat/person capture without changing old data", async () => {
  const f = fixture();
  const before = JSON.stringify(f.topology.oldProject);
  const prepared = await prepareIndependentCreationProject(f.topology, f.input);
  f.events.push(`browser:${prepared.projectId}`, `chat:${prepared.projectId}`, `person:${prepared.projectId}`);
  assert.equal(prepared.projectId, "project.new");
  assert.equal(f.topology.projectId, "project.old");
  assert.equal(JSON.stringify(f.topology.oldProject), before);
  assert.deepEqual(f.events, ["create", "identity", "select:project.new", "browser:project.new", "chat:project.new", "person:project.new"]);
  assert.deepEqual(f.identity(), { schemaVersion: 1, runId: "run.new", workspace: "test-workspace", projectId: "project.new", domainId: "web-automation", flowId: null, outcome: "prepared", savedFlowHash: null });
});

test("repair, replay and other noncreation entry keep exact existing scope", async () => {
  const f = fixture();
  assert.equal(await prepareIndependentCreationProject(f.topology, { ...f.input, independent: false }), f.topology);
  assert.deepEqual(f.events, []);
});

test("created project identity survives context selection failure before any browser", async () => {
  const f = fixture();
  f.topology.control.selectExistingContext = async () => { throw new Error("synthetic selection failure"); };
  await assert.rejects(prepareIndependentCreationProject(f.topology, f.input), /selection failure/);
  assert.equal(f.identity()?.projectId, "project.new");
  assert.deepEqual(f.events, ["create", "identity"]);
});
