import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { copyEnvLocal } from "../env-local.mjs";

const SECRET = "DEEPSEEK_API_KEY=sk-fixture-not-a-real-key\n";

async function withRoots(body) {
  const base = await mkdtemp(path.join(tmpdir(), "worktree-env-"));
  const fromRoot = path.join(base, "working");
  const toRoot = path.join(base, "task-a");
  try {
    await mkdir(fromRoot);
    await mkdir(toRoot);
    await body({ base, fromRoot, toRoot });
  } finally {
    await rm(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

test("an existing .env.local is copied across, byte for byte", async () => {
  await withRoots(async ({ fromRoot, toRoot }) => {
    await writeFile(path.join(fromRoot, ".env.local"), SECRET);
    const result = await copyEnvLocal({ fromRoot, toRoot });
    assert.equal(result.copied, true);
    assert.equal(await readFile(path.join(toRoot, ".env.local"), "utf8"), SECRET);
    assert.equal(path.basename(result.from), ".env.local");
    assert.equal(path.resolve(result.to), path.resolve(path.join(toRoot, ".env.local")));
  });
});

test("the value never appears in what comes back, so it cannot reach a log line by accident", async () => {
  await withRoots(async ({ fromRoot, toRoot }) => {
    await writeFile(path.join(fromRoot, ".env.local"), SECRET);
    const result = await copyEnvLocal({ fromRoot, toRoot });
    const rendered = JSON.stringify(result);
    assert.equal(rendered.includes("sk-fixture-not-a-real-key"), false);
    assert.equal(rendered.includes("DEEPSEEK"), false);
    assert.deepEqual(Object.keys(result).sort(), ["copied", "from", "to", "why"]);
  });
});

test("no .env.local at the source is an answer that says so, not a failure", async () => {
  await withRoots(async ({ fromRoot, toRoot }) => {
    const result = await copyEnvLocal({ fromRoot, toRoot });
    assert.equal(result.copied, false);
    assert.match(result.why, /there is no \.env\.local in /u);
    await assert.rejects(readFile(path.join(toRoot, ".env.local"), "utf8"), (error) => error.code === "ENOENT");
  });
});

test("a destination that already has one keeps it rather than being overwritten", async () => {
  await withRoots(async ({ fromRoot, toRoot }) => {
    await writeFile(path.join(fromRoot, ".env.local"), SECRET);
    await writeFile(path.join(toRoot, ".env.local"), "OWN=1\n");
    const result = await copyEnvLocal({ fromRoot, toRoot });
    assert.equal(result.copied, false);
    assert.match(result.why, /already has its own \.env\.local/u);
    assert.equal(await readFile(path.join(toRoot, ".env.local"), "utf8"), "OWN=1\n");
  });
});

test("a missing destination directory is raised, never reported as a missing source", async () => {
  await withRoots(async ({ base, fromRoot }) => {
    await writeFile(path.join(fromRoot, ".env.local"), SECRET);
    await assert.rejects(copyEnvLocal({ fromRoot, toRoot: path.join(base, "no-such-worktree") }), (error) => error.code === "ENOENT");
  });
});

test("copying a checkout's .env.local onto itself is refused", async () => {
  await withRoots(async ({ fromRoot }) => {
    await writeFile(path.join(fromRoot, ".env.local"), SECRET);
    await assert.rejects(copyEnvLocal({ fromRoot, toRoot: fromRoot }), /Refusing to copy \.env\.local onto itself/u);
    await assert.rejects(copyEnvLocal({ fromRoot, toRoot: `${fromRoot}${path.sep}` }), /Refusing to copy \.env\.local onto itself/u);
  });
});
