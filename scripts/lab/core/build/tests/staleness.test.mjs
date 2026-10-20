import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { scanNewest } from "../index.mjs";

test("a test file is not a source the build ships, so it cannot make a build stale", async () => {
  // Otherwise touching any test blocks every run, which is precisely what
  // happens while somebody is fixing assertions beside a running one.
  const root = await mkdtemp(path.join(os.tmpdir(), "newest-src-"));
  try {
    await mkdir(path.join(root, "src", "tests"), { recursive: true });
    await writeFile(path.join(root, "src", "shipped.ts"), "export const a = 1;\n");
    await writeFile(path.join(root, "src", "beside.test.ts"), "// not shipped\n");
    await writeFile(path.join(root, "src", "tests", "inside.ts"), "// not shipped\n");
    const scan = await scanNewest(path.join(root, "src"));
    assert.match(scan.newestPath ?? "", /shipped\.ts$/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a directory that does not exist has no newest file", async () => {
  assert.deepEqual(await scanNewest(path.join(os.tmpdir(), "no-such-directory-for-scan-newest", "src")), { newestMs: 0, newestPath: null });
});
