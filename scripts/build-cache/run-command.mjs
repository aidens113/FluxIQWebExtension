// Runs a step's command the way pnpm runs a package script: through the
// platform shell, in the package directory, with the package's and the
// workspace root's `node_modules/.bin` ahead of PATH, so `tsc` is the pinned
// compiler whichever process called the cache.

import { spawn } from "node:child_process";
import path from "node:path";

/**
 * @param {string} command
 * @param {{ cwd: string, repoRoot: string, env?: NodeJS.ProcessEnv, stdio?: import("node:child_process").StdioOptions }} options
 * @returns {Promise<number>} the exit code; a signal counts as 1
 */
export function runCommand(command, options) {
  const env = { ...(options.env ?? process.env) };
  const pathKey = Object.keys(env).find((name) => name.toUpperCase() === "PATH") ?? "PATH";
  for (const name of Object.keys(env)) if (name.toUpperCase() === "PATH" && name !== pathKey) delete env[name];
  const bins = [path.join(options.cwd, "node_modules", ".bin"), path.join(options.repoRoot, "node_modules", ".bin")];
  env[pathKey] = [...bins, env[pathKey] ?? ""].filter((entry) => entry !== "").join(path.delimiter);
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd: options.cwd, env, shell: true, stdio: options.stdio ?? "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}
