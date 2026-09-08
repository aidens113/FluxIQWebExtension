import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { RunnerFailure } from "./failure.js";
import { certifyDemoLlmSetupArtifacts } from "./demo-llm-attestation.js";

const sentinel = "synthetic-deepseek-setup-sentinel-123456";

async function demoWorkspace(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-demo-llm-attestation-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const relative of ["evidence", "logs", "fluxiq-root/.fluxiq"]) {
    await mkdir(path.join(root, ...relative.split("/")), { recursive: true });
  }
  await writeFile(path.join(root, "latest-evidence.json"), JSON.stringify({ runId: "safe-run", path: "evidence/safe-run" }));
  await writeFile(path.join(root, "evidence", "summary.json"), JSON.stringify({ status: "passed" }));
  await writeFile(path.join(root, "logs", "core.log"), "setup completed\n");
  await writeFile(path.join(root, "fluxiq-root", ".fluxiq", "metadata.json"), JSON.stringify({ provider: "deepseek" }));
  return root;
}

test("returns only sanitized aggregate attestation for the reviewed setup scope", async t => {
  const root = await demoWorkspace(t);
  const result = await certifyDemoLlmSetupArtifacts({ workspaceRoot: root, secretLiteral: sentinel });
  assert.equal(result.findingCount, 0);
  assert.deepEqual(result.categories, []);
  assert.ok(result.scannedFiles >= 4);
  assert.equal(JSON.stringify(result).includes(root), false);
  assert.equal(JSON.stringify(result).includes(sentinel), false);
});

test("blocks setup success when an approved persistent artifact contains the secret", async t => {
  const root = await demoWorkspace(t);
  await writeFile(path.join(root, "logs", "provider.log"), "unexpected=" + sentinel);
  await assert.rejects(
    certifyDemoLlmSetupArtifacts({ workspaceRoot: root, secretLiteral: sentinel }),
    error => error instanceof RunnerFailure
      && error.message === "DeepSeek setup artifact attestation failed"
      && !error.message.includes(sentinel)
      && !error.message.includes(root),
  );
});
