import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { freshStoreCopy, freshStoreCopyRefusal } from "../fresh-store-copy.js";

test("copies the store under <work>/fluxiq-root/.fluxiq, leaving out security", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "p4d-copy-"));
  try {
    const source = path.join(root, "source", ".fluxiq");
    await mkdir(path.join(source, "artifacts", "automation-studio"), { recursive: true });
    await mkdir(path.join(source, "security"), { recursive: true });
    await writeFile(path.join(source, "global.sqlite"), "db");
    await writeFile(path.join(source, "artifacts", "automation-studio", "x.json"), "{}");
    await writeFile(path.join(source, "security", "login-attempts.json"), "{}");
    const work = path.join(root, "test-runs", "run-1");
    const copy = await freshStoreCopy({ sourceFluxiqDir: source, work });
    assert.equal(copy.fluxiqDir, path.join(work, "fluxiq-root", ".fluxiq"));
    assert.equal(copy.rootDir, path.join(work, "fluxiq-root"));
    assert.deepEqual((await readdir(copy.fluxiqDir)).sort(), ["artifacts", "global.sqlite"]);
    await assert.rejects(freshStoreCopy({ sourceFluxiqDir: source, work }), /exists already/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("refuses a work directory outside test-runs", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "p4d-refuse-"));
  try {
    assert.match(freshStoreCopyRefusal(path.join(root, "elsewhere")) ?? "", /test-runs/);
    assert.equal(freshStoreCopyRefusal(path.join(root, "test-runs", "x")), null);
    await assert.rejects(freshStoreCopy({ sourceFluxiqDir: root, work: path.join(root, "elsewhere") }), /test-runs/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
