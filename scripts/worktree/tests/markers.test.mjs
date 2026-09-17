import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { clearMarker, readMarker, writeMarker } from "../markers.mjs";

test("a marker is absent until written, reads back trimmed, and is gone once cleared", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "lab-pair-markers-"));
  try {
    assert.equal(await readMarker(root, "install"), null);
    await writeMarker(root, "install", "lock-blob");
    await writeMarker(root, "build", "commit-a");
    assert.equal(await readMarker(root, "install"), "lock-blob");
    assert.equal(await readMarker(root, "build"), "commit-a");
    await clearMarker(root, "install");
    await clearMarker(root, "install");
    assert.equal(await readMarker(root, "install"), null);
    assert.equal(await readMarker(root, "build"), "commit-a");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an unknown marker kind is refused rather than written somewhere unexpected", async () => {
  await assert.rejects(readMarker("F:/x", "other"), /Unknown worktree marker "other"/u);
});

test("a marker that cannot be read for any reason but absence is an error, not null", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "lab-pair-markers-"));
  try {
    // A directory where the marker file should be cannot be read as a file.
    await writeMarker(root, "build", "x");
    await rm(path.join(root, "node_modules", ".lab-pair-built-commit"));
    await mkdir(path.join(root, "node_modules", ".lab-pair-built-commit"));
    await assert.rejects(readMarker(root, "build"), (error) => error?.code === "EISDIR");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
