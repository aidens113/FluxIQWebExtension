// The source fingerprint changes with source and only with source.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { sourceFingerprint } from "../index.mjs";

async function repository(root) {
  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(root, "docs"), { recursive: true });
  await writeFile(path.join(root, ".gitignore"), "dist/\ntest-runs/\n", "utf8");
  await writeFile(path.join(root, "src", "a.ts"), "export const a = 1;\n", "utf8");
  await writeFile(path.join(root, "docs", "notes.txt"), "notes\n", "utf8");
  execFileSync("git", ["init", "-q", root]);
  execFileSync("git", ["-C", root, "-c", "core.autocrlf=false", "add", "-A"]);
}

test("unchanged source digests the same; source edits, new untracked files, deletions and a second root's edits each change it", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "live-guards-fingerprint-"));
  try {
    const web = path.join(directory, "web");
    const core = path.join(directory, "core");
    await repository(web);
    await repository(core);
    const first = await sourceFingerprint([web, core]);
    assert.match(first.digest, /^sha256:[0-9a-f]{64}$/u);
    assert.equal(first.files, 4);
    assert.equal((await sourceFingerprint([web, core])).digest, first.digest);

    // Nothing a rerun can learn from: build output, run evidence, docs, Markdown.
    await mkdir(path.join(web, "dist"), { recursive: true });
    await writeFile(path.join(web, "dist", "a.js"), "built\n", "utf8");
    await mkdir(path.join(web, "test-runs", "run-x"), { recursive: true });
    await writeFile(path.join(web, "test-runs", "run-x", "run.json"), "{}\n", "utf8");
    await writeFile(path.join(web, "docs", "notes.txt"), "a debug was written\n", "utf8");
    await writeFile(path.join(web, "docs", "run-x.md"), "# debug\n", "utf8");
    await writeFile(path.join(web, "README.md"), "# readme\n", "utf8");
    assert.equal((await sourceFingerprint([web, core])).digest, first.digest);

    await writeFile(path.join(web, "src", "a.ts"), "export const a = 2;\n", "utf8");
    const edited = await sourceFingerprint([web, core]);
    assert.notEqual(edited.digest, first.digest);

    await writeFile(path.join(web, "src", "b.ts"), "export const b = 1;\n", "utf8");
    const untracked = await sourceFingerprint([web, core]);
    assert.notEqual(untracked.digest, edited.digest);

    await rm(path.join(web, "src", "a.ts"));
    const deleted = await sourceFingerprint([web, core]);
    assert.notEqual(deleted.digest, untracked.digest);

    await writeFile(path.join(core, "src", "a.ts"), "export const a = 3;\n", "utf8");
    assert.notEqual((await sourceFingerprint([web, core])).digest, deleted.digest);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a root that is not a git checkout fails the fingerprint rather than digesting nothing", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "live-guards-fingerprint-"));
  try {
    await assert.rejects(sourceFingerprint([path.join(directory, "missing")]));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
