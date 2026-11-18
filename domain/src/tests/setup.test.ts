// Setup upgrades an older data layout itself (setup.ts), so a person whose
// data predates Core's v2 layout can start the panel (2026-11-17).
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setupWebAutomationFluxIQ } from "../setup";

test("setup upgrades a v1 data layout and then sets up", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-setup-v1-"));
  try {
    // Core reports a root with legacy `.fluxiq/data` and no `config.json` as layout v1.
    await mkdir(path.join(root, ".fluxiq", "data"), { recursive: true });
    const result = await setupWebAutomationFluxIQ(root);
    assert.ok(result.migration, "a v1 layout is migrated before setup");
    assert.ok(existsSync(path.join(root, ".fluxiq", "config.json")), "the v2 commit marker is written");
    const again = await setupWebAutomationFluxIQ(root);
    assert.equal(again.migration, undefined, "a second setup finds the current layout and does not migrate");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("setup upgrades a v1 root that has run before, keeping its runtime store", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-setup-v1-ran-"));
  try {
    // A runtime that ran on layout v1 kept its store at `.fluxiq/artifacts/runtime`, outside the
    // legacy roots, and Automation Studio data stages into `artifacts/` too. Core's migration
    // used to archive the legacy roots and then stop at this collision, half-migrated (t932).
    const fluxiqRoot = path.join(root, ".fluxiq");
    const projects = path.join(fluxiqRoot, "data", "programs", "automation-studio", "projects.json");
    await mkdir(path.dirname(projects), { recursive: true });
    await writeFile(projects, JSON.stringify({ version: 1, data: {
      categories: [],
      projects: [{ id: "project.legacy", name: "Legacy project", description: "", categoryId: null, createdAt: 1, updatedAt: 1, customHierarchyNodes: [], deletedHierarchyIds: [], workspacePrefs: {} }]
    } }), "utf8");
    const runtimeStore = path.join(fluxiqRoot, "artifacts", "runtime", "store.json");
    await mkdir(path.dirname(runtimeStore), { recursive: true });
    await writeFile(runtimeStore, "{\"kept\":true}", "utf8");

    const result = await setupWebAutomationFluxIQ(root);

    assert.ok(result.migration, "a v1 layout is migrated before setup");
    assert.ok(existsSync(path.join(fluxiqRoot, "config.json")), "the v2 commit marker is written");
    assert.equal(existsSync(path.join(fluxiqRoot, ".migration")), false, "no migration is left half done");
    assert.equal(await readFile(runtimeStore, "utf8"), "{\"kept\":true}");
    assert.deepEqual((await readdir(path.join(fluxiqRoot, "artifacts"))).sort(), ["automation-studio", "runtime"]);
    const again = await setupWebAutomationFluxIQ(root);
    assert.equal(again.migration, undefined, "a second setup finds the current layout and does not migrate");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("setup on a fresh root does not migrate", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-setup-fresh-"));
  try {
    const result = await setupWebAutomationFluxIQ(root);
    assert.equal(result.migration, undefined);
    assert.ok(existsSync(path.join(root, ".fluxiq", "config.json")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
