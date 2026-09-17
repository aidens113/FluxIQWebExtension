// Running pnpm in one worktree of the pair. Its output goes to stderr, so the
// script's stdout holds only the result a caller reads.

import { spawn } from "node:child_process";

/** @param {string} root @param {string[]} args @param {NodeJS.ProcessEnv} env @returns {Promise<void>} */
export function runPnpm(root, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", args, { cwd: root, env, stdio: ["ignore", 2, 2], shell: process.platform === "win32", windowsHide: true });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`pnpm ${args.join(" ")} in ${root} exited with ${signal ?? code}`));
    });
  });
}
