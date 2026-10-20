// Dispatching one task command. Output is one JSON object on stdout so a
// calling agent can read the result without parsing prose; anything a person
// needs to read goes to stderr. This mirrors how the Lab's pair command
// reports, for the same reason: an agent reads the result, a person reads the
// progress.
//
// Each command's module is imported only when that command runs. Most of them
// load FluxIQ Core's shared task rules from the Core beside this checkout as
// they are imported, and refuse a Core too old to have them; `sync-core` is the
// command that brings such a Core up to date, so importing the others up front
// made it refuse exactly the Core it exists to fix (t735).

import { parseTaskArguments } from "./arguments.mjs";

// Which commands exist is command-options.mjs's to say, and parseTaskArguments
// already refuses anything else -- checking it twice is how the two lists come
// to disagree.

export async function runTaskCommandLine({ argv, repositoryRoot, coreRepositoryRoot }) {
  const { command, positional, flags, values } = parseTaskArguments(argv);

  const shared = {
    repositoryRoot,
    coreRepositoryRoot,
    dryRun: Boolean(flags["dry-run"]),
    allowRunning: Boolean(flags["allow-running"])
  };

  if (command === "list") {
    const { listTasks } = await import("./list.mjs");
    return { command, tasks: await listTasks(repositoryRoot) };
  }

  // Prune takes no id: it works across everything the lifecycles leave behind,
  // which is precisely the material no single task owns any more.
  if (command === "prune") {
    const { pruneTasks } = await import("./prune.mjs");
    return { command, ...await pruneTasks({ ...shared, base: values.base, days: values.days === undefined ? undefined : Number(values.days) }) };
  }

  // Like prune it takes no id: it moves the Core this checkout builds against,
  // which is shared by every task beside it rather than owned by one.
  if (command === "sync-core") {
    const { syncSharedCore } = await import("./sync-core.mjs");
    return { command, ...await syncSharedCore({ ...shared, to: values.to ?? "dev" }) };
  }

  if (command === "start") {
    const { startTask } = await import("./start.mjs");
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
    const { finishTask } = await import("./finish.mjs");
    return { command, ...await finishTask({ ...shared, id, skipChecks: Boolean(flags["skip-checks"]), fullCheck: Boolean(flags["full-check"]), title: positional.slice(1).join(" ") || undefined }) };
  }

  const { abandonTask } = await import("./abandon.mjs");
  return { command, ...await abandonTask({ ...shared, id, force: Boolean(flags.force) }) };
}
