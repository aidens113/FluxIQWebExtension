// No test reads a checkout's env files.
//
// A checkout's `.env.local` holds this machine's real provider key: the Lab's
// live runs read it there (`live-llm/provider-credential.ts`), and
// `scripts/worktree/env-local.mjs` copies it into every task worktree. A test
// that pointed a reader at the checkout instead of a directory it made would
// hold that key, and one more step would spend it. So inside a test process
// every env-file reader refuses a directory outside the temporary directory,
// before it opens a file: the only env files a test can read are ones it wrote.

import { realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runningUnderTestRunner } from "./test-process.js";

/**
 * Refuses, inside a test process, to read `fileName` from `directory` unless
 * that directory is under the temporary directory. Outside a test it allows
 * everything; this is not a run's configuration, only a test's fence.
 */
export function assertTestMayReadEnvFile(directory: string, fileName: string, underTest: boolean = runningUnderTestRunner()): void {
  if (!underTest) return;
  const resolved = path.resolve(directory);
  if (temporaryRoots().some((root) => isInside(resolved, root))) return;
  throw new Error(`A test may read ${fileName} only from a temporary directory it made, and ${resolved} is not one: a checkout's env files hold this machine's real provider key, which no test may obtain`);
}

function temporaryRoots(): string[] {
  const root = path.resolve(os.tmpdir());
  try {
    const real = realpathSync.native(root);
    return real === root ? [root] : [root, real];
  } catch {
    return [root];
  }
}

function isInside(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  if (relative === "" || path.isAbsolute(relative)) return false;
  return relative.split(path.sep)[0] !== "..";
}
