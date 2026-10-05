import assert from "node:assert/strict";
import test from "node:test";
import { writeCreationContext, type CreationContext } from "../context.js";

test("identity remains bound on failure and screens unrelated private fields", async () => {
  const writes: unknown[] = [];
  const writer = { async writeStructured(name: string, value: unknown) { assert.equal(name, "snapshots/creation-context.json"); writes.push(value); } };
  const base: CreationContext = { schemaVersion: 1, runId: "run.test", workspace: "workspace", projectId: "project.new", domainId: "web-automation", flowId: null, outcome: "prepared", savedFlowHash: null };
  await writeCreationContext(writer, { ...base, privatePage: "synthetic ignored data" } as CreationContext);
  const failed = await writeCreationContext(writer, { ...base, flowId: "flow.draft", outcome: "failed" });
  assert.equal(failed.projectId, "project.new");
  assert.equal(failed.flowId, "flow.draft");
  assert.equal(failed.savedFlowHash, null);
  assert.equal(JSON.stringify(writes).includes("privatePage"), false);
});
