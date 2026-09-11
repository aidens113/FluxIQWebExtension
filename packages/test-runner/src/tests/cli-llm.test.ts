import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runCli } from "../cli.js";

test("runCli rejects validated live LLM mode before target or process startup", async () => {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "fluxiq-live-cli-gate-"));
  const stderr: string[] = [];
  const originalWrite = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array) => { stderr.push(String(chunk)); return true; }) as typeof process.stderr.write;
  try {
    const code = await runCli([
      "run", "basic-form", "--live-llm", "--llm-profile", "deepseek-lab",
      "--llm-provider", "deepseek", "--llm-model", "deepseek-chat", "--llm-task", "diagnose",
    ], { FLUXIQ_WEB_EXTENSION_ROOT: repositoryRoot });
    assert.equal(code, 1);
    assert.match(stderr.join(""), /Live LLM execution is fail-closed/);
    assert.equal(stderr.join("").includes("DEEPSEEK_API_KEY"), false);
  } finally {
    process.stderr.write = originalWrite;
    await rm(repositoryRoot, { recursive: true, force: true });
  }
});