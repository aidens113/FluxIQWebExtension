// Running pnpm in one worktree. Its output goes to stderr, so the calling
// script's stdout holds only the result a caller reads.
//
// The environment is passed explicitly rather than inherited, because the
// callers that matter here strip the provider secrets out of it first; an
// omitted `env` would hand a worktree install the whole of `process.env`
// without anyone writing that down. `shell` is set on Windows because pnpm is
// a `.cmd` shim there, which `spawn` cannot start on its own.
//
// `onLine`, when given, is shown each line pnpm prints to stdout, which is
// still forwarded to stderr as it arrives: a caller may read one line (Core's
// `{"build-cache":...}` outcome) without the build's output disappearing.

import { spawn } from "node:child_process";

// `async` so the guard below rejects rather than throwing synchronously: a
// function that returns a promise everywhere else must not throw in the
// caller's own frame on one argument, or a caller's `.catch` never sees it.
/** @param {string} root @param {string[]} args @param {{ env: NodeJS.ProcessEnv, onLine?: (line: string) => void }} options @returns {Promise<void>} */
export async function runPnpm(root, args, options) {
  const env = options?.env;
  if (env === undefined || env === null) throw new Error(`pnpm ${args.join(" ")} in ${root} was given no environment; pass { env }`);
  return new Promise((resolve, reject) => {
    const onLine = options.onLine;
    const child = spawn("pnpm", args, { cwd: root, env, stdio: ["ignore", onLine ? "pipe" : 2, 2], shell: process.platform === "win32", windowsHide: true });
    let pending = "";
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      process.stderr.write(chunk);
      const lines = (pending + chunk).split(/\r?\n/u);
      pending = lines.pop();
      for (const line of lines) onLine(line);
    });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (onLine && pending !== "") onLine(pending);
      if (code === 0) resolve();
      else reject(new Error(`pnpm ${args.join(" ")} in ${root} exited with ${signal ?? code}`));
    });
  });
}
