// Which running processes are working inside the pair, so a move never swaps
// the files a campaign has loaded.
//
// A process counts when its command line names a path *below* either root.
// The Lab starts its own children by absolute path -- `run-lab.mjs`, the
// scenario lab server, Chromium's `--load-extension`, Core's Next build -- so
// a campaign in flight shows up here. A root named on its own, as in
// `--ext-root F:/fxlab/lab-ext`, does not count, and neither this process nor
// any of its ancestors counts: they are the ones asking.

/**
 * @param {{
 *   processes: Array<{ pid: number, parentPid: number | null, name: string, commandLine: string }>,
 *   roots: string[],
 *   selfPid: number,
 * }} input
 */
export function processesUsingRoots({ processes, roots, selfPid }) {
  const parentOf = new Map(processes.map((entry) => [entry.pid, entry.parentPid]));
  const askers = new Set();
  for (let pid = selfPid; pid !== null && pid !== undefined && !askers.has(pid); pid = parentOf.get(pid)) askers.add(pid);
  const needles = roots.map((root) => `${comparable(root).replace(/\/+$/u, "")}/`);
  return processes.filter((entry) => !askers.has(entry.pid) && needles.some((needle) => comparable(entry.commandLine).includes(needle)));
}

function comparable(text) {
  return text.replaceAll("\\", "/").toLowerCase();
}
