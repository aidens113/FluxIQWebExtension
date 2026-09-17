// Reading the command line. Every option is explicit and anything a command
// does not take is refused rather than ignored, because a silently dropped
// `--worktree` would put a task's edits in the shared checkout that the flag
// existed to avoid -- and a `--force` dropped on the wrong command would look
// like it had been honoured.
//
// A flag that belongs to another command is refused by name and says where it
// belongs, because that is the mistake worth telling someone about: the flag is
// real, the spelling is right, and the only thing wrong is which command it was
// handed to. command-options.mjs owns the table.

import { COMMAND_OPTIONS } from "./command-options.mjs";

const COMMANDS = Object.keys(COMMAND_OPTIONS);

export function parseTaskArguments(argv) {
  const [command, ...rest] = argv;
  if (!command) throw new Error(`Name a command: ${COMMANDS.join(", ")}.`);
  const known = COMMAND_OPTIONS[command];
  if (!known) throw new Error(`Unknown command ${JSON.stringify(command)}. Use ${COMMANDS.join(", ")}.`);

  const options = { command, positional: [], flags: {}, values: {} };

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      options.positional.push(token);
      continue;
    }
    const name = token.slice(2);
    if (known.flags.includes(name)) {
      options.flags[name] = true;
    } else if (known.values.includes(name)) {
      const value = rest[index + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${token} needs a value.`);
      options.values[name] = value;
      index += 1;
    } else {
      throw new Error(unknownOption(command, token, name, known));
    }
  }

  return options;
}

function unknownOption(command, token, name, known) {
  const elsewhere = COMMANDS.filter((other) => other !== command
    && (COMMAND_OPTIONS[other].flags.includes(name) || COMMAND_OPTIONS[other].values.includes(name)));
  if (elsewhere.length > 0) {
    return `${token} is not an option of "${command}"; it belongs to ${elsewhere.map((other) => `"${other}"`).join(" and ")}.`;
  }
  const takes = [...known.flags, ...known.values.map((value) => `${value} <value>`)];
  return `Unknown option ${token}. "${command}" takes ${takes.length === 0 ? "no options" : takes.map((option) => `--${option}`).join(", ")}.`;
}
