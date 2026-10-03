import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { REPOSITORY_CHANGES_MAX, parsePorcelainChanges, repositoryChanges } from "../repository-changes.js";

test("porcelain entries become a status and a path each, a rename naming the path it now has", () => {
  const stdout = " M domain/src/a.ts\0?? docs/new file.md\0R  apps/new.ts\0apps/old.ts\0MM b.ts\0";
  assert.deepEqual(parsePorcelainChanges(stdout), {
    changes: [
      { status: " M", path: "domain/src/a.ts" },
      { status: "??", path: "docs/new file.md" },
      { status: "R ", path: "apps/new.ts", from: "apps/old.ts" },
      { status: "MM", path: "b.ts" },
    ],
  });
  assert.deepEqual(parsePorcelainChanges(""), { changes: [] });
});

test("the list is bounded and says how many it left out", () => {
  const stdout = Array.from({ length: REPOSITORY_CHANGES_MAX + 3 }, (_, index) => ` M f${index}.ts\0`).join("");
  const parsed = parsePorcelainChanges(stdout);
  assert.equal(parsed.changes.length, REPOSITORY_CHANGES_MAX);
  assert.equal(parsed.changesOmitted, 3);
});

test("a real checkout's uncommitted changes are named by path and status, never by content", async t => {
  const root = await mkdtemp(path.join(tmpdir(), "repository-changes-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd: root });
  git("init", "-q");
  await writeFile(path.join(root, "kept.ts"), "export const a = 1;\n");
  git("add", ".");
  git("commit", "-q", "-m", "init");
  await writeFile(path.join(root, "kept.ts"), "export const a = 'CONTENT-MARKER';\n");
  await writeFile(path.join(root, "added.ts"), "CONTENT-MARKER\n");
  const changes = await repositoryChanges(root);
  assert.deepEqual(changes, { changes: [{ status: " M", path: "kept.ts" }, { status: "??", path: "added.ts" }] });
  assert.doesNotMatch(JSON.stringify(changes), /CONTENT-MARKER/u);
});
