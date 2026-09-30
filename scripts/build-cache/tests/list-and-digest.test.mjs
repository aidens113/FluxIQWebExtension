import assert from "node:assert/strict";
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { digestFiles, isInsideRoots, listInputFiles, openStatCache } from "../index.mjs";

let scratch;
beforeEach(async () => {
  scratch = await mkdtemp(path.join(os.tmpdir(), "build-cache-list-"));
  await put("pkg/src/index.ts", "export {};");
  await put("pkg/src/deep/a.ts", "a");
  await put("pkg/dist/index.js", "emitted");
  await put("pkg/node_modules/x/index.js", "installed");
  await put("pkg/.lab-instances/one/build.js", "instance");
  await put("pkg/test-runs/run/evidence.json", "{}");
});
afterEach(async () => { await rm(scratch, { recursive: true, force: true }); });

async function put(relative, text) {
  const file = path.join(scratch, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
}

const root = () => ({ label: "pkg", path: path.join(scratch, "pkg"), exclude: [path.join(scratch, "pkg", "dist")] });
const digest = async (roots) => digestFiles(await listInputFiles(roots), await openStatCache(null));

test("excluded directory names and a root's own outputs are never listed", async () => {
  const listed = (await listInputFiles([root()])).map((file) => file.label);
  assert.deepEqual(listed, ["pkg/src/deep/a.ts", "pkg/src/index.ts"]);
});

test("an absent root is listed once, as absent", async () => {
  const listed = await listInputFiles([{ label: "gone", path: path.join(scratch, "gone"), exclude: [] }]);
  assert.deepEqual(listed, [{ label: "gone", path: null }]);
});

test("the digest changes on an edit, an addition, a removal and a rename", async () => {
  const before = await digest([root()]);
  await put("pkg/src/index.ts", "export const x = 1;");
  const edited = await digest([root()]);
  assert.notEqual(edited, before);
  await put("pkg/src/new.ts", "");
  const added = await digest([root()]);
  assert.notEqual(added, edited);
  await rm(path.join(scratch, "pkg/src/new.ts"));
  assert.equal(await digest([root()]), edited);
  await rename(path.join(scratch, "pkg/src/deep/a.ts"), path.join(scratch, "pkg/src/deep/b.ts"));
  assert.notEqual(await digest([root()]), edited);
});

test("the digest ignores everything under excluded directories and outputs", async () => {
  const before = await digest([root()]);
  await put("pkg/dist/other.js", "more output");
  await put("pkg/node_modules/y/index.js", "another install");
  await put("pkg/.lab-instances/two/x.js", "another instance");
  assert.equal(await digest([root()]), before);
});

test("isInsideRoots answers exactly what the listing walks", async () => {
  const resolved = { roots: [root(), { label: "base.json", path: path.join(scratch, "base.json"), exclude: [] }] };
  assert.equal(isInsideRoots(path.join(scratch, "pkg/src/index.ts"), resolved), true);
  assert.equal(isInsideRoots(path.join(scratch, "pkg/src"), resolved), true);
  assert.equal(isInsideRoots(path.join(scratch, "base.json"), resolved), true);
  assert.equal(isInsideRoots(path.join(scratch, "pkg/dist/index.js"), resolved), false);
  assert.equal(isInsideRoots(path.join(scratch, "pkg/node_modules/x/index.js"), resolved), false);
  assert.equal(isInsideRoots(path.join(scratch, "pkg/.lab-instances/one/build.js"), resolved), false);
  assert.equal(isInsideRoots(path.join(scratch, "elsewhere.ts"), resolved), false);
});
