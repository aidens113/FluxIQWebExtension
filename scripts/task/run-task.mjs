#!/usr/bin/env node
// The `pnpm task` entry point. A task is one unit of work -- one brief -- on
// its own branch, so that it can be validated before it reaches `dev`, merged
// with a boundary that can be reverted whole, and thrown away without leaving
// anything behind if it goes wrong.
//
//   pnpm task start <slug> [--worktree] [--core] [--base DIR] [--from BRANCH]
//     --core branches FluxIQ Core under the same name, so one id names the unit
//     of work in both histories; finish that side with Core's own pnpm task.
//   pnpm task finish <id> [title words...] [--skip-checks] [--allow-running]
//   pnpm task abandon <id> [--force] [--allow-running]
//   pnpm task list
//   pnpm task prune [--days N] [--base DIR] [--allow-running]
//
// Every command takes --dry-run, which decides all refusals and reports what it
// would do without changing anything.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTaskCommandLine } from "./index.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const coreRepositoryRoot = path.resolve(repositoryRoot, "..", "!FluxIQ");

try {
  const result = await runTaskCommandLine({ argv: process.argv.slice(2), repositoryRoot, coreRepositoryRoot });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  if (error?.cause instanceof Error) process.stderr.write(`${error.cause.message}\n`);
  process.exitCode = 1;
}
