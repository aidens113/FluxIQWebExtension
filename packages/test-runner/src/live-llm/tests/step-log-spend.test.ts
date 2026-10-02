// What the run's own step log says it paid the provider for.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readLiveLlmStepLogSpend } from "../step-log-spend.js";

async function stepLog(t: test.TestContext, folders: Record<string, unknown>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-step-log-spend-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [name, meta] of Object.entries(folders)) {
    await mkdir(path.join(root, name), { recursive: true });
    if (meta !== undefined) await writeFile(path.join(root, name, "meta.json"), typeof meta === "string" ? meta : JSON.stringify(meta));
  }
  return root;
}

const provider = (kind: string, costUsd: unknown) => ({ kind, provider: "deepseek", model: "deepseek-flash", costUsd });

test("every provider call in the step log is counted once, by kind, and tool and test steps are not calls", async (t) => {
  // `run-muqk713g-d08ad3dc`'s shape in miniature: the chat's interpreter call, a
  // build decision, a tool step, a playback test step, a judge and two re-author decisions.
  const directory = await stepLog(t, {
    "0001-chat": provider("chat", 0.000305376),
    "0002-tool-core.run_node": { kind: "tool", phase: "explore" },
    "0003-decide": provider("decide", 0.002679912),
    "0026-test-core.run_node": { kind: "test", phase: "explore" },
    "0034-judge": provider("judge", 0.00176142),
    "0037-decide": provider("decide", 0.00499728),
    "0039-decide": provider("decide", null),
    "index.md": undefined,
  });
  const spend = await readLiveLlmStepLogSpend(directory);
  assert.deepEqual(spend, {
    calls: 5,
    estimatedCostUsd: 0.009743988,
    byKind: {
      chat: { calls: 1, estimatedCostUsd: 0.000305376 },
      decide: { calls: 3, estimatedCostUsd: 0.007677192 },
      judge: { calls: 1, estimatedCostUsd: 0.00176142 },
    },
  });
});

test("a folder without a complete meta.json is not a call yet, and an absent or empty log is no reading at all", async (t) => {
  const directory = await stepLog(t, { "0001-chat": provider("chat", 0.0003), "0002-decide": undefined, "0003-decide": "{\"kind\":\"dec" });
  assert.equal((await readLiveLlmStepLogSpend(directory))?.calls, 1);
  assert.equal(await readLiveLlmStepLogSpend(path.join(directory, "missing")), null);
  assert.equal(await readLiveLlmStepLogSpend(await stepLog(t, { "0001-tool-core.run_node": { kind: "tool" } })), null);
});
