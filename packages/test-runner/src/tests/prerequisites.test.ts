import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadScenarioManifests } from "../scenarios.js";

test("scenario loading fails closed when the built registry is missing", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-prerequisite-"));
  try { await assert.rejects(loadScenarioManifests(root), (error: unknown) => typeof error === "object" && error !== null && "category" in error && error.category === "environment.missing"); }
  finally { await rm(root, { recursive: true, force: true }); }
});
