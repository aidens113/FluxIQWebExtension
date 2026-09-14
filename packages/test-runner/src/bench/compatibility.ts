import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";
import type { CampaignCompatibility } from "./campaign/index.js";

const execFileAsync = promisify(execFile);

export type CampaignCompatibilityInput = {
  repositoryRoot: string;
  fluxiqRepositoryRoot: string;
  testRunnerBuildPath: string;
  extensionBuildPath: string;
  scenarioLabBuildPath: string;
  browserVersion?: () => Promise<string>;
};

/** Computes the strict, non-secret experiment fingerprint required for create and resume. */
export async function buildCampaignCompatibility(input: CampaignCompatibilityInput): Promise<CampaignCompatibility> {
  const [facility, core, facilityLock, coreLock, testRunner, extension, scenarioLab, browserVersion] = await Promise.all([
    cleanRevision(input.repositoryRoot, "facility"),
    cleanRevision(input.fluxiqRepositoryRoot, "Core"),
    hashFile(path.join(input.repositoryRoot, "pnpm-lock.yaml")),
    hashFile(path.join(input.fluxiqRepositoryRoot, "pnpm-lock.yaml")),
    hashDirectory(input.testRunnerBuildPath),
    hashDirectory(input.extensionBuildPath),
    hashDirectory(input.scenarioLabBuildPath),
    (input.browserVersion ?? installedBrowserVersion)(),
  ]);
  return {
    repositories: { facilityCommit: facility, coreCommit: core },
    lockfiles: { facilitySha256: facilityLock, coreSha256: coreLock },
    builds: { testRunnerSha256: testRunner, extensionSha256: extension, scenarioLabSha256: scenarioLab },
    environment: {
      platform: process.platform,
      architecture: process.arch,
      browserName: "chromium",
      browserVersion,
      locale: "en-US",
      timezone: "UTC",
      viewport: { width: 1280, height: 720 },
    },
  };
}

async function cleanRevision(root: string, label: string): Promise<string> {
  const cwd = path.resolve(root);
  const safeDirectory = `safe.directory=${cwd.replaceAll("\\", "/")}`;
  const [revision, status] = await Promise.all([
    execFileAsync("git", ["-c", safeDirectory, "rev-parse", "HEAD"], { cwd }),
    execFileAsync("git", ["-c", safeDirectory, "status", "--porcelain"], { cwd }),
  ]);
  if (status.stdout.trim()) throw new Error(`Resumable benchmark requires a clean ${label} repository`);
  const commit = revision.stdout.trim();
  if (!/^[0-9a-f]{40}$/u.test(commit)) throw new Error(`${label} repository did not report a commit`);
  return commit;
}

async function hashFile(file: string): Promise<string> {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function hashDirectory(root: string): Promise<string> {
  const directory = path.resolve(root);
  const hash = createHash("sha256");
  let files = 0;
  async function walk(current: string): Promise<void> {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(target);
      else if (entry.isFile()) {
        files += 1;
        hash.update(path.relative(directory, target).replaceAll("\\", "/"));
        hash.update("\0");
        hash.update(await readFile(target));
      }
    }
  }
  await walk(directory);
  if (files === 0) throw new Error(`Benchmark build directory is empty: ${directory}`);
  return hash.digest("hex");
}

async function installedBrowserVersion(): Promise<string> {
  // Extension runs use launchPersistentContext with the full Chromium build.
  // `chromium.launch({ headless: true })` may select Playwright's separate
  // headless-shell binary, so launching it would fingerprint the wrong browser.
  const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
  try { return browser.version(); }
  finally { await browser.close(); }
}
