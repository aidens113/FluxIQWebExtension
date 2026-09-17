import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { staleDirectories } from "../stale-directories.mjs";

const DAY = 24 * 60 * 60 * 1000;

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "stale-"));
  return {
    root,
    /** Writes a file `age` days old, ageing every directory above it to match. */
    async place(relative, { age, bytes = 16 }) {
      const file = path.join(root, relative);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, "x".repeat(bytes));
      const when = new Date(Date.now() - age * DAY);
      for (let current = file; current !== root; current = path.dirname(current)) await utimes(current, when, when);
    },
    async dispose() {
      await rm(root, { recursive: true, force: true });
    }
  };
}

test("a label directory nothing has touched since the cutoff is stale, with its size", async (t) => {
  const fs = await fixture();
  t.after(() => fs.dispose());
  await fs.place("scratch/old-label/bundle.js", { age: 6, bytes: 100 });
  await fs.place("scratch/old-label/nested/more.js", { age: 5, bytes: 40 });

  const stale = await staleDirectories([path.join(fs.root, "scratch")], { cutoff: Date.now() - 3 * DAY });

  assert.equal(stale.length, 1);
  assert.equal(stale[0].root, path.join(fs.root, "scratch", "old-label"));
  assert.equal(stale[0].name, "old-label");
  assert.equal(stale[0].bytes, 140);
  assert.ok(stale[0].modified < Date.now() - 3 * DAY);
});

test("a file written deep inside keeps the whole directory alive", async (t) => {
  // This is why the walk exists at all. A Lab instance is written through
  // extension/dist/ and host/, so its own mtime stays at whenever it was first
  // created; reading only the top would delete the build a browser has loaded.
  const fs = await fixture();
  t.after(() => fs.dispose());
  await fs.place("scratch/live/extension/dist/background.js", { age: 6 });
  await utimes(path.join(fs.root, "scratch", "live", "extension", "dist", "background.js"), new Date(), new Date());

  const stale = await staleDirectories([path.join(fs.root, "scratch")], { cutoff: Date.now() - 3 * DAY });

  assert.deepEqual(stale.map((entry) => entry.name), []);
});

test("only immediate children are candidates, never the root or a loose file", async (t) => {
  // The root is what the ignore rules name and what the next build writes into;
  // deleting it buys an empty directory's worth of nothing and breaks the build.
  const fs = await fixture();
  t.after(() => fs.dispose());
  await fs.place("scratch/old-label/bundle.js", { age: 6 });
  await fs.place("scratch/stray.txt", { age: 6 });

  const stale = await staleDirectories([path.join(fs.root, "scratch")], { cutoff: Date.now() - 3 * DAY });

  assert.deepEqual(stale.map((entry) => entry.name), ["old-label"]);
});

test("a scratch root that is not there is skipped, not an error", async (t) => {
  // Every root is discovered from disk, but a concurrent worker's run can
  // delete and recreate one between the scan and the walk. A prune that threw
  // there would be a prune nobody could rely on running.
  const fs = await fixture();
  t.after(() => fs.dispose());
  await fs.place("scratch/old-label/bundle.js", { age: 6 });

  const stale = await staleDirectories(
    [path.join(fs.root, "absent"), path.join(fs.root, "scratch")],
    { cutoff: Date.now() - 3 * DAY }
  );

  assert.deepEqual(stale.map((entry) => entry.name), ["old-label"]);
});

test("the cutoff is a boundary, not a range", async (t) => {
  const fs = await fixture();
  t.after(() => fs.dispose());
  await fs.place("scratch/label/bundle.js", { age: 4 });

  assert.equal((await staleDirectories([path.join(fs.root, "scratch")], { cutoff: Date.now() - 5 * DAY })).length, 0);
  assert.equal((await staleDirectories([path.join(fs.root, "scratch")], { cutoff: Date.now() - 3 * DAY })).length, 1);
});
