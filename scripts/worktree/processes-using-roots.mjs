// Which running processes are working inside a set of worktrees, so a move or
// a removal never pulls files out from under something that has them loaded.
//
// A process counts when its command line names a path *below* one of the
// roots. Long-running children are started by absolute path -- `run-lab.mjs`,
// the scenario lab server, Chromium's `--load-extension`, Core's Next build --
// so work in flight shows up here. A root named on its own, as in
// `--ext-root F:/fxlab/lab-ext`, does not count, and neither this process nor
// any of its ancestors counts: they are the ones asking.
//
// The listing and this process's id are taken from the machine unless a caller
// supplies them, which is how the selection itself stays testable without a
// fixture process tree.

import { listProcesses } from "./process-list.mjs";

/**
 * @param {string[]} roots
 * @param {{ processes?: Array<{ pid: number, parentPid: number | null, name: string, commandLine: string }>, selfPid?: number }} [options]
 */
export async function processesUsingRoots(roots, options = {}) {
  const processes = options.processes ?? await listProcesses();
  const selfPid = options.selfPid ?? process.pid;
  const parentOf = new Map(processes.map((entry) => [entry.pid, entry.parentPid]));
  const askers = new Set();
  for (let pid = selfPid; pid !== null && pid !== undefined && !askers.has(pid); pid = parentOf.get(pid)) askers.add(pid);
  const needles = roots.map((root) => `${comparable(root).replace(/\/+$/u, "")}/`);
  return processes.filter((entry) => !askers.has(entry.pid) && needles.some((needle) => comparable(entry.commandLine).includes(needle)));
}

function comparable(text) {
  return text.replaceAll("\\", "/").toLowerCase();
}
