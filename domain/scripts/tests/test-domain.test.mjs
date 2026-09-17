import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import test from "node:test";

// Importing the runner must not start a test run; the module refuses to be
// loaded any other way than as the entry point unless this says so.
process.env.DOMAIN_TEST_BUILD_IMPORT_ONLY = "1";
const { assertTestBuildOutdirIsRemovable, cleanTestBuildOutdir, resolveTestBuildOutdir } =
  await import("../test-domain.mjs");

const ROOT = path.resolve(path.join(tmpdir(), "fluxiq-domain-root"));

test("the two directories the runner produces are the two it may empty", () => {
  assertTestBuildOutdirIsRemovable(path.join(ROOT, ".test-build"), ROOT);
  assertTestBuildOutdirIsRemovable(path.join(ROOT, ".test-build-scratch", "worker-a"), ROOT);
  assertTestBuildOutdirIsRemovable(resolveTestBuildOutdir(undefined, ROOT), ROOT);
  assertTestBuildOutdirIsRemovable(resolveTestBuildOutdir("worker-a", ROOT), ROOT);
});

// Each case is a path that a defect, a typo or a hostile label could put in
// front of a recursive delete. None of them is this run's output directory, so
// every one must be refused before anything is removed.
const refused = [
  ["an empty string", ""],
  ["a value that is not a string", undefined],
  ["a relative path", ".test-build"],
  ["the package root itself", ROOT],
  ["the package source tree", path.join(ROOT, "src")],
  ["the repository above the package", path.dirname(ROOT)],
  ["a directory outside the package", path.join(path.dirname(ROOT), "other-package", ".test-build")],
  ["the scratch parent a concurrent labelled run shares", path.join(ROOT, ".test-build-scratch")],
  ["a directory below the labelled output", path.join(ROOT, ".test-build-scratch", "worker-a", "nested")],
  ["a directory below the unlabelled output", path.join(ROOT, ".test-build", "nested")],
  ["a name that merely starts the same way", path.join(ROOT, ".test-build-old")],
  ["a path that climbs back out through ..", `${ROOT}${path.sep}.test-build${path.sep}..${path.sep}..`],
  ["a label that is not kebab-case", path.join(ROOT, ".test-build-scratch", "Worker A")]
];

for (const [description, outdir] of refused) {
  test(`the guard refuses ${description}`, () => {
    assert.throws(
      () => assertTestBuildOutdirIsRemovable(outdir, ROOT),
      /Refusing to empty the domain test build directory/,
      `${JSON.stringify(outdir)} must be refused`
    );
  });
}

test("an unexpected outdir is refused with its contents still on disk", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "fluxiq-outdir-guard-"));
  try {
    const root = path.join(workspace, "domain");
    const sourceTree = path.join(root, "src");
    const neighbour = path.join(workspace, "not-the-domain-package");
    await mkdir(sourceTree, { recursive: true });
    await mkdir(neighbour, { recursive: true });
    const keptFiles = [path.join(sourceTree, "index.ts"), path.join(neighbour, "important.txt")];
    for (const file of keptFiles) await writeFile(file, "must survive");

    for (const outdir of [sourceTree, neighbour, root, workspace, ""]) {
      await assert.rejects(
        cleanTestBuildOutdir(outdir, root),
        /Refusing to empty the domain test build directory/,
        `${JSON.stringify(outdir)} must be refused`
      );
    }

    for (const file of keptFiles) assert.ok(existsSync(file), `${file} must still exist`);
    assert.deepEqual((await readdir(workspace)).sort(), ["domain", "not-the-domain-package"]);
  } finally {
    await rm(workspace, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
});

test("the run's own outdir is emptied and left ready for the build", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "fluxiq-outdir-clean-"));
  try {
    const root = path.join(workspace, "domain");
    const outdir = resolveTestBuildOutdir(undefined, root);
    const staleTree = path.join(outdir, "!FluxIQ", "packages");
    await mkdir(staleTree, { recursive: true });
    await writeFile(path.join(staleTree, "stale.js"), "// an older build shape");
    await writeFile(path.join(outdir, "deleted-test.mjs"), "// a test file that no longer exists");

    await cleanTestBuildOutdir(outdir, root);

    assert.deepEqual(await readdir(outdir), [], "the out directory must be empty after cleaning");
    assert.ok(existsSync(outdir), "the out directory must exist for esbuild to write into");
    assert.ok(existsSync(root), "cleaning must not remove the package root");
  } finally {
    await rm(workspace, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
});

test("cleaning a missing outdir creates it rather than failing", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "fluxiq-outdir-missing-"));
  try {
    const root = path.join(workspace, "domain");
    const outdir = resolveTestBuildOutdir("worker-a", root);
    await cleanTestBuildOutdir(outdir, root);
    assert.deepEqual(await readdir(outdir), []);
  } finally {
    await rm(workspace, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
});

// Two labelled runs execute at once, so neither may sit inside the other and
// neither may be the scratch parent: cleaning one must leave the other alone.
test("concurrent labelled runs own separate directories", () => {
  const first = resolveTestBuildOutdir("worker-a", ROOT);
  const second = resolveTestBuildOutdir("worker-b", ROOT);
  assert.notEqual(first, second);
  assert.ok(path.relative(first, second).startsWith(".."), "one label's output must not lie inside another's");
  assert.ok(path.relative(second, first).startsWith(".."), "one label's output must not lie inside another's");
  assert.notEqual(first, resolveTestBuildOutdir(undefined, ROOT));
});

test("a label that is not kebab-case never becomes a path", () => {
  for (const label of ["", "../escape", "Worker", "worker a", "-leading", "x".repeat(65)]) {
    assert.throws(
      () => resolveTestBuildOutdir(label, ROOT),
      /DOMAIN_TEST_BUILD_LABEL must be lowercase kebab-case/,
      `${JSON.stringify(label)} must be refused`
    );
  }
});
