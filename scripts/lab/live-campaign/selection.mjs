import { isRealisticScenario, unrealisticScenarioRefusal } from "../../../packages/test-runner/src/realistic-scenarios/index.ts";

/**
 * The tasks a campaign runs, in catalog order for --kind and --all and in the
 * order given for ids. A live run with no selection is refused.
 *
 * Every Lab run opens only the ten realistic scenarios (user rule, 2026-09-29;
 * the list is `packages/test-runner/src/realistic-scenarios/index.ts`): a task
 * named by id on any other scenario is refused before anything runs, and
 * --kind, --all and a dry run's default choose among the realistic scenarios'
 * tasks only.
 *
 * @template {{ id: string, kind: string, scenarioId: string }} T
 * @param {readonly T[]} catalog
 * @param {{ taskIds: string[], kinds: string[], all: boolean, limit?: number, dryRun: boolean }} options
 * @returns {T[]}
 */
export function selectTasks(catalog, options) {
  const byId = new Map(catalog.map((task) => [task.id, task]));
  const unknown = options.taskIds.filter((id) => !byId.has(id));
  if (unknown.length > 0) throw new Error(`Unknown task id ${unknown.join(", ")}`);
  const realistic = catalog.filter((task) => isRealisticScenario(task.scenarioId));
  let selected;
  if (options.taskIds.length > 0) {
    selected = [...new Set(options.taskIds)].map((id) => byId.get(id));
    const outside = selected.filter((task) => !isRealisticScenario(task.scenarioId));
    const refusal = unrealisticScenarioRefusal(outside.map((task) => task.scenarioId), `lab:campaign task ${outside.map((task) => task.id).join(", ")}`);
    if (refusal !== null) throw new Error(refusal);
  } else if (options.kinds.length > 0) selected = realistic.filter((task) => options.kinds.includes(task.kind));
  else if (options.all || options.dryRun) selected = [...realistic];
  else throw new Error("A live campaign needs a selection: task ids, --kind, or --all (a --dry-run shows every realistic-scenario task)");
  const limited = options.limit === undefined ? selected : selected.slice(0, options.limit);
  if (limited.length === 0) throw new Error("The selection matches no task");
  return limited;
}
