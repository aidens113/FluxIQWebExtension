import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { buildCampaignCompatibility } from "../compatibility.js";

const execute = promisify(execFile);

test("builds a stable strict compatibility fingerprint and refuses a dirty repository", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-campaign-compatibility-"));
  const facility = path.join(root, "facility");
  const core = path.join(root, "core");
  try {
    for (const repository of [facility, core]) {
      await mkdir(path.join(repository, "build"), { recursive: true });
      await writeFile(path.join(repository, "pnpm-lock.yaml"), `lock-${path.basename(repository)}\n`);
      await writeFile(path.join(repository, "build", "entry.js"), `export const owner = ${JSON.stringify(path.basename(repository))};\n`);
      await execute("git", ["init", "-q"], { cwd: repository });
      await execute("git", ["config", "user.email", "test@example.invalid"], { cwd: repository });
      await execute("git", ["config", "user.name", "Test"], { cwd: repository });
      await execute("git", ["add", "."], { cwd: repository });
      await execute("git", ["commit", "-qm", "fixture"], { cwd: repository });
    }
    const input = { repositoryRoot: facility, fluxiqRepositoryRoot: core, testRunnerBuildPath: path.join(facility, "build"), extensionBuildPath: path.join(facility, "build"), scenarioLabBuildPath: path.join(core, "build"), browserVersion: async () => "Chrome/fixture" };
    const first = await buildCampaignCompatibility(input);
    const second = await buildCampaignCompatibility(input);
    assert.deepEqual(first, second);
    assert.match(first.repositories.facilityCommit, /^[0-9a-f]{40}$/u);
    assert.match(first.builds.extensionSha256, /^[0-9a-f]{64}$/u);
    assert.deepEqual(first.environment, { platform: process.platform, architecture: process.arch, browserName: "chromium", browserVersion: "Chrome/fixture", locale: "en-US", timezone: "UTC", viewport: { width: 1280, height: 720 } });

    await writeFile(path.join(facility, "dirty.txt"), "dirty\n");
    await assert.rejects(buildCampaignCompatibility(input), /clean facility repository/u);
  } finally {
    // Git can release its working directory a few milliseconds after the
    // child exit is observed on Windows. Keep fixture cleanup bounded but
    // tolerant of that documented transient sharing window.
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});
