/**
 * The tasks a campaign runs, in catalog order for --kind and --all and in the
 * order given for ids. A live run with no selection is refused.
 *
 * @template {{ id: string, kind: string }} T
 * @param {readonly T[]} catalog
 * @param {{ taskIds: string[], kinds: string[], all: boolean, limit?: number, dryRun: boolean }} options
 * @returns {T[]}
 */
export function selectTasks(catalog, options) {
  const byId = new Map(catalog.map((task) => [task.id, task]));
  const unknown = options.taskIds.filter((id) => !byId.has(id));
  if (unknown.length > 0) throw new Error(`Unknown task id ${unknown.join(", ")}`);
  let selected;
  if (options.taskIds.length > 0) selected = [...new Set(options.taskIds)].map((id) => byId.get(id));
  else if (options.kinds.length > 0) selected = catalog.filter((task) => options.kinds.includes(task.kind));
  else if (options.all || options.dryRun) selected = [...catalog];
  else throw new Error("A live campaign needs a selection: task ids, --kind, or --all (a --dry-run shows every task)");
  const limited = options.limit === undefined ? selected : selected.slice(0, options.limit);
  if (limited.length === 0) throw new Error("The selection matches no task");
  return limited;
}
