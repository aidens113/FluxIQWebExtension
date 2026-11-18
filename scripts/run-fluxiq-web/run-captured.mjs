import { spawn as spawnProcess } from "node:child_process";
import { createInterface } from "node:readline";

/**
 * Runs one preparation command with its standard output captured line by line
 * (its errors still reach the terminal), and resolves with its exit code and
 * those lines. A command that cannot start rejects.
 */
export function runCaptured({ command, args, cwd, env = process.env, shell = false, spawn = spawnProcess }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, shell, stdio: ["ignore", "pipe", "inherit"] });
    const lines = [];
    createInterface({ input: child.stdout, crlfDelay: Infinity }).on("line", (line) => lines.push(line));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, lines }));
  });
}
