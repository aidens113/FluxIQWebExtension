import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { coreRootOf, importCoreScript } from "../index.mjs";

async function withLayout(run) {
  const base = await mkdtemp(path.join(os.tmpdir(), "core-scripts-"));
  try {
    const extRoot = path.join(base, "ext");
    await mkdir(path.join(extRoot, "domain"), { recursive: true });
    await writeFile(path.join(extRoot, "domain", "package.json"), JSON.stringify({ dependencies: { fluxiq: "link:../../!FluxIQ/packages/fluxiq" } }));
    await run({ base, extRoot, coreRoot: path.join(base, "!FluxIQ") });
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

test("Core is the directory the domain links fluxiq from", async () => {
  await withLayout(async ({ extRoot, coreRoot }) => {
    assert.equal(coreRootOf(extRoot), coreRoot);
  });
});

test("a module present in Core is loaded from there", async () => {
  await withLayout(async ({ extRoot, coreRoot }) => {
    await mkdir(path.join(coreRoot, "scripts", "task"), { recursive: true });
    await writeFile(path.join(coreRoot, "scripts", "task", "probe.mjs"), "export const probe = 42;\n");
    const loaded = await importCoreScript("scripts/task/probe.mjs", { extRoot });
    assert.equal(loaded.probe, 42);
  });
});

test("a missing Core and a Core without the module each say what to do", async () => {
  await withLayout(async ({ extRoot, coreRoot }) => {
    await assert.rejects(importCoreScript("scripts/task/probe.mjs", { extRoot }), /FluxIQ Core is not beside .*Create the Core sibling/su);
    await mkdir(coreRoot, { recursive: true });
    await assert.rejects(importCoreScript("scripts/task/probe.mjs", { extRoot }), /has no scripts\/task\/probe\.mjs: that Core predates .*Merge Core's dev into it/su);
  });
});
