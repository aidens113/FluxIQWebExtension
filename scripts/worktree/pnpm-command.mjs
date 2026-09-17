// Running pnpm in one worktree. Its output goes to stderr, so the calling
// script's stdout holds only the result a caller reads.
//
// The environment is passed explicitly rather than inherited, because the
// callers that matter here strip the provider secrets out of it first; an
// omitted `env` would hand a worktree install the whole of `process.env`
// without anyone writing that down. `shell` is set on Windows because pnpm is
// a `.cmd` shim there, which `spawn` cannot start on its own.

import { spawn } from "node:child_process";

// `async` so the guard below rejects rather than throwing synchronously: a
// function that returns a promise everywhere else must not throw in the
// caller's own frame on one argument, or a caller's `.catch` never sees it.
/** @param {string} root @param {string[]} args @param {{ env: NodeJS.ProcessEnv }} options @returns {Promise<void>} */
export async function runPnpm(root, args, options) {
  const env = options?.env;
  if (env === undefined || env === null) throw new Error(`pnpm ${args.join(" ")} in ${root} was given no environment; pass { env }`);
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", args, { cwd: root, env, stdio: ["ignore", 2, 2], shell: process.platform === "win32", windowsHide: true });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`pnpm ${args.join(" ")} in ${root} exited with ${signal ?? code}`));
    });
  });
}
