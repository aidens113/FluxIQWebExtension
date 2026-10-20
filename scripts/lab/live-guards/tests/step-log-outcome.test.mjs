// A killed run's step log names Core's balance code, and the guard reads it.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readStepLogOutcome } from "../step-log-outcome.mjs";

async function runWithMeta(meta) {
  const root = await mkdtemp(path.join(os.tmpdir(), "f4-steplog-"));
  const step = path.join(root, "2026-10-19", "run-x", "steps", "0001-model");
  await mkdir(step, { recursive: true });
  await writeFile(path.join(step, "meta.json"), JSON.stringify(meta));
  return root;
}

const base = { provider: "deepseek", model: "deepseek-flash", status: "error", httpStatus: 400, costUsd: 0, finishedAt: "2026-10-19T00:00:00.000Z" };

test("a step meta carrying Core's balance code is a balance failure", async () => {
  const root = await runWithMeta({ ...base, error: { code: "llm.provider_balance_exhausted", message: "balance is exhausted" } });
  try {
    const outcome = await readStepLogOutcome(root, "run-x");
    assert.equal(outcome?.calls, 1);
    assert.equal(outcome?.balanceFailure?.code, "llm.provider_balance_exhausted");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a step meta with an unrelated error code is not a balance failure", async () => {
  const root = await runWithMeta({ ...base, error: { code: "llm.provider_http_error", message: "bad request" } });
  try {
    assert.equal((await readStepLogOutcome(root, "run-x"))?.balanceFailure, null);
  } finally { await rm(root, { recursive: true, force: true }); }
});
