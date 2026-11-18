// Setup upgrades an older data layout itself (setup.ts), so a person whose
// data predates Core's v2 layout can start the panel (2026-11-17).
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
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
