// Kills one process and every process below it, by pid. It never looks at a
// command line: the pid comes from the spend ledger, which the launcher wrote
// for its own process, so nothing but that launch's tree can match.
//
// Windows: `taskkill /PID <pid> /T /F`. Elsewhere: the descendants are read
// from `ps -A -o pid=,ppid=` and sent SIGKILL deepest first, then the pid.

import { spawnSync } from "node:child_process";

/**
 * @param {number} pid
 * @returns {Promise<{ ok: boolean, detail: string }>}
 */
export async function killProcessTree(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return { ok: false, detail: `${pid} is not a process id` };
  if (process.platform === "win32") {
    const result = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { encoding: "utf8", windowsHide: true });
    const detail = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() || (result.error?.message ?? "");
    return { ok: result.status === 0, detail };
  }
  const listed = spawnSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8" });
  if (listed.status !== 0) return { ok: false, detail: `ps failed: ${(listed.stderr || listed.error?.message || "").trim()}` };
  const children = new Map();
  for (const line of listed.stdout.split(/\r?\n/u)) {
    const [child, parent] = line.trim().split(/\s+/u).map(Number);
    if (!Number.isInteger(child) || !Number.isInteger(parent)) continue;
    children.set(parent, [...(children.get(parent) ?? []), child]);
  }
  const order = [];
  const visit = (each) => {
    for (const child of children.get(each) ?? []) visit(child);
    order.push(each);
  };
  visit(pid);
  const failures = [];
  for (const each of order) {
    try {
      process.kill(each, "SIGKILL");
    } catch (error) {
      // A descendant that exited between the listing and the kill is already gone.
      if (error?.code !== "ESRCH") failures.push(`${each}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { ok: failures.length === 0, detail: failures.length === 0 ? `killed ${order.length} process(es): ${order.join(", ")}` : failures.join("; ") };
}
