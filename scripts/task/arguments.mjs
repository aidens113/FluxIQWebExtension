// Reading the command line. Every flag is explicit and unknown flags are
// refused rather than ignored, because a silently dropped `--worktree` would
// put a task's edits in the shared checkout that the flag existed to avoid.

const FLAGS = new Set(["--worktree", "--core", "--dry-run", "--skip-checks", "--allow-running", "--force", "--json"]);
const VALUES = new Set(["--base", "--from"]);

export function parseTaskArguments(argv) {
  const [command, ...rest] = argv;
  if (!command) throw new Error("Name a command: start, finish, abandon or list.");

  const options = { command, positional: [], flags: {}, values: {} };

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (FLAGS.has(token)) {
      options.flags[token.slice(2)] = true;
    } else if (VALUES.has(token)) {
      const value = rest[index + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${token} needs a value.`);
      options.values[token.slice(2)] = value;
      index += 1;
    } else if (token.startsWith("--")) {
      throw new Error(`Unknown flag ${token}. Known flags: ${[...FLAGS, ...VALUES].join(", ")}.`);
    } else {
      options.positional.push(token);
    }
  }

  return options;
}
