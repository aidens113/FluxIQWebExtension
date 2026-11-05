import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { attemptCacheShare } from "../cache-share.js";

test("sums what each model step recorded, and leaves out a step with none", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "attempt-cache-share-"));
  try {
    const step = async (name: string, meta: string) => {
      await mkdir(path.join(root, name));
      await writeFile(path.join(root, name, "meta.json"), meta);
    };
    await step("0001-chat", JSON.stringify({ usage: { inputTokens: 1_000, cacheHitInputTokens: 0, cacheWriteInputTokens: 1_000 } }));
    await step("0002-tool-core.run_node", JSON.stringify({ usage: null }));
    await step("0003-decide", JSON.stringify({ usage: { inputTokens: 9_000, cacheHitInputTokens: 8_300, cacheWriteInputTokens: 200 } }));
    await step("0004-decide", "not whole yet");
    await mkdir(path.join(root, "0005-decide"));
    assert.deepEqual(await attemptCacheShare(root), { inputTokens: 10_000, readTokens: 8_300, writtenTokens: 1_200, hitPercent: 83 });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("says it does not know when no step recorded any input, or there is no such folder", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "attempt-cache-share-"));
  try {
    assert.deepEqual(await attemptCacheShare(path.join(root, "no-such-folder")), { inputTokens: 0, readTokens: 0, writtenTokens: 0, hitPercent: null });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
