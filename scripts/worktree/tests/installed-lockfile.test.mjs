import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { installedLockfile } from "../installed-lockfile.mjs";
import { writeMarker } from "../markers.mjs";

const LOCK = "lockfileVersion: '9.0'\n";

async function withRoot(body) {
  const root = await mkdtemp(path.join(tmpdir(), "installed-lock-"));
  try { await body(root); } finally { await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
}

/** The git blob id of `content`, which is what a caller has for the committed lockfile. */
function blobId(content) {
  return execFileSync("git", ["hash-object", "--stdin"], { input: content, encoding: "utf8" }).trim();
}

test("pnpm's own copy of the lockfile is what an install is measured by", async () => {
  await withRoot(async (root) => {
    await mkdir(path.join(root, "node_modules", ".pnpm"), { recursive: true });
    await writeFile(path.join(root, "node_modules", ".pnpm", "lock.yaml"), LOCK);
    assert.equal(await installedLockfile(root), blobId(LOCK));
  });
});

test("pnpm's copy wins over a marker, because a later install by hand updates only pnpm's", async () => {
  await withRoot(async (root) => {
    await mkdir(path.join(root, "node_modules", ".pnpm"), { recursive: true });
    await writeFile(path.join(root, "node_modules", ".pnpm", "lock.yaml"), LOCK);
    await writeMarker(root, "install", "0000000000000000000000000000000000000000");
    assert.equal(await installedLockfile(root), blobId(LOCK));
  });
});

test("without pnpm's copy the marker is the fallback, and without either nothing is claimed", async () => {
  await withRoot(async (root) => {
    assert.equal(await installedLockfile(root), null);
    await writeMarker(root, "install", "abc123");
    assert.equal(await installedLockfile(root), "abc123");
  });
});
