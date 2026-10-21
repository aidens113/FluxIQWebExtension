import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { readProjectBuildState } from "../project-build-state.js";

async function store(rows: Record<string, unknown>): Promise<{ file: string; root: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "p4d-state-"));
  const file = path.join(root, "global.sqlite");
  const db = new DatabaseSync(file);
  db.exec(`create table "automation.state" (id text primary key, kind text, data text, created_at_ms integer, updated_at_ms integer)`);
  db.exec(`create table "secret.keys" (id text primary key, data text)`);
  for (const [id, value] of Object.entries(rows)) db.prepare(`insert into "automation.state" values (?, 'automation.state', ?, 0, 0)`).run(id, JSON.stringify(value));
  db.close();
  return { file, root };
}

const base = "projects/p/flows/f/";

test("reads the build's record and its Flow's candidate draft by id, read-only", async () => {
  const { file, root } = await store({ [`${base}project-builds/build.b/build`]: { kind: "project_build", buildId: "build.b" }, [`${base}candidate-draft`]: { kind: "flow_candidate_draft" }, [`${base}other`]: { kind: "x" } });
  try {
    const state = readProjectBuildState({ globalDatabase: file, projectId: "p", flowId: "f", buildId: "build.b" });
    assert.equal(state.record.buildId, "build.b");
    assert.equal(state.draft?.kind, "flow_candidate_draft");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a Flow without a draft reads as none; a build without a record is refused", async () => {
  const { file, root } = await store({ [`${base}project-builds/build.b/build`]: { buildId: "build.b" } });
  try {
    assert.equal(readProjectBuildState({ globalDatabase: file, projectId: "p", flowId: "f", buildId: "build.b" }).draft, null);
    assert.throws(() => readProjectBuildState({ globalDatabase: file, projectId: "p", flowId: "f", buildId: "build.z" }), /no record of build build\.z/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
