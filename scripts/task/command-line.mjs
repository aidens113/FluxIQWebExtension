// Dispatching one task command. Output is one JSON object on stdout so a
// calling agent can read the result without parsing prose; anything a person
// needs to read goes to stderr. This mirrors how the Lab's pair command
// reports, for the same reason: an agent reads the result, a person reads the
// progress.

import { parseTaskArguments } from "./arguments.mjs";
import { abandonTask } from "./abandon.mjs";
import { finishTask } from "./finish.mjs";
import { listTasks } from "./list.mjs";
import { pruneTasks } from "./prune.mjs";
import { startTask } from "./start.mjs";

const COMMANDS = new Set(["start", "finish", "abandon", "list", "prune"]);

export async function runTaskCommandLine({ argv, repositoryRoot, coreRepositoryRoot }) {
  const { command, positional, flags, values } = parseTaskArguments(argv);
  if (!COMMANDS.has(command)) throw new Error(`Unknown command "${command}". Use start, finish, abandon, list or prune.`);

  const shared = {
    repositoryRoot,
    coreRepositoryRoot,
    dryRun: Boolean(flags["dry-run"]),
    allowRunning: Boolean(flags["allow-running"])
  };

  if (command === "list") return { command, tasks: await listTasks(repositoryRoot) };

  // Prune takes no id: it works across everything the lifecycles leave behind,
  // which is precisely the material no single task owns any more.
  if (command === "prune") {
    return { command, ...await pruneTasks({ ...shared, base: values.base, days: values.days === undefined ? undefined : Number(values.days) }) };
  }

  if (command === "start") {
    return {
      command,
      ...await startTask({
        ...shared,
        slug: positional[0],
        worktree: Boolean(flags.worktree),
        core: Boolean(flags.core),
        base: values.base,
        from: values.from ?? "dev"
      })
    };
  }

  const id = positional[0];
  if (!id) throw new Error(`pnpm task ${command} needs a task id, for example "t042". Open tasks are listed by "pnpm task list".`);

  if (command === "finish") {
    return { command, ...await finishTask({ ...shared, id, skipChecks: Boolean(flags["skip-checks"]), title: positional.slice(1).join(" ") || undefined }) };
  }

  return { command, ...await abandonTask({ ...shared, id, force: Boolean(flags.force) }) };
}
