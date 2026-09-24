#!/usr/bin/env node
// Run one live task against an owned, throwaway FluxIQ, on a machine whose
// `.env.local` describes an existing installation.
//
// An isolated target refuses `FLUXIQ_TEST_BASE_URL` and
// `FLUXIQ_TEST_GATEWAY_URL`, which that file sets, so the run has to be told to
// ignore the file: `FLUXIQ_TEST_ENV_FILES=none`. Neither of those two facts is
// stated by either refusal -- one says a project id is required, the other that
// an isolated target cannot use existing-install configuration, and the escape
// is documented only in a comment above the function that implements it. Three
// runs were spent rediscovering that on 2026-09-24, so it lives here now.
//
// Nothing is forwarded from the file, and credentials in particular are not.
// The isolated topology bootstraps its own account; supplying this machine's
// username and password makes the run fail authentication against a FluxIQ that
// has never heard of it (`FluxIQ authentication failed (401)`). The provider key
// still reaches the run, because `live-llm/provider-credential.ts` reads it
// separately and has a test for exactly this case.

import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const task = process.argv[2];
if (!task) {
  process.stderr.write("Usage: node scripts/lab/live-isolated.mjs <task-id> [extra lab args]\n");
  process.exit(1);
}

process.stderr.write(`${JSON.stringify({ lab: "live-isolated", task, target: "isolated" })}\n`);

const child = spawn(process.execPath, [path.join(repositoryRoot, "scripts", "lab", "live-campaign.mjs"), task, ...process.argv.slice(3)], {
  cwd: repositoryRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    FLUXIQ_TEST_ENV_FILES: "none",
    FLUXIQ_TEST_TARGET: "isolated",
    FLUXIQ_TEST_RUNS_DIR: process.env.FLUXIQ_TEST_RUNS_DIR ?? path.join(repositoryRoot, "test-runs")
  }
});
child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
