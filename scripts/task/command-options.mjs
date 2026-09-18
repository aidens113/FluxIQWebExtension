// Which options each command actually takes.
//
// A flat set of known flags accepts every flag on every command, so
// `pnpm task finish t042 --worktree` parses cleanly, does nothing, and says
// nothing: the caller believes it asked for something and the command believes
// it was never asked. That is the same defect an unknown flag is already
// refused for, and it is the worse half of it, because the flag is real and the
// spelling is right -- there is nothing for the caller to notice.
//
// One table, read by the parser to validate and by the dispatcher to know which
// commands exist, so the two can never disagree about what `pnpm task` accepts.

export const COMMAND_OPTIONS = {
  start: { flags: ["worktree", "core", "allow-running", "dry-run"], values: ["base", "from"] },
  finish: { flags: ["skip-checks", "allow-running", "dry-run"], values: [] },
  abandon: { flags: ["force", "allow-running", "dry-run"], values: [] },
  list: { flags: [], values: [] },
  prune: { flags: ["allow-running", "dry-run"], values: ["base", "days"] },
  "sync-core": { flags: ["allow-running", "dry-run"], values: ["to"] }
};
