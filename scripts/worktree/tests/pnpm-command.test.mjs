import assert from "node:assert/strict";
import test from "node:test";
import { runPnpm } from "../pnpm-command.mjs";

// The environment is the whole reason this takes an options object rather than
// a bare third argument. Its callers hand it an environment with the provider
// secrets stripped out; an omitted one that quietly fell back to process.env
// would pass every key this repository has to a worktree install without
// anyone having written that down, and nothing would fail to say so.

test("an omitted environment is refused rather than filled in from this process", async () => {
  await assert.rejects(runPnpm("F:/nowhere", ["install"], {}), /was given no environment; pass \{ env \}/u);
  await assert.rejects(runPnpm("F:/nowhere", ["install"], { env: undefined }), /was given no environment; pass \{ env \}/u);
  await assert.rejects(runPnpm("F:/nowhere", ["install"], { env: null }), /was given no environment; pass \{ env \}/u);
});

test("the third argument being an environment, as it used to be, is refused rather than ignored", async () => {
  await assert.rejects(runPnpm("F:/nowhere", ["install"], { PATH: process.env.PATH }), /was given no environment; pass \{ env \}/u);
});

test("a refusal names the command and the worktree it was asked to run in", async () => {
  await assert.rejects(runPnpm("F:/nowhere", ["install", "--offline"], {}), /pnpm install --offline in F:\/nowhere/u);
});
