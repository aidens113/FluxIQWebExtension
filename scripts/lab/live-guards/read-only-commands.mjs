// The Lab subcommands that run no product: they read what a past run wrote, or
// stop or draw one. None is checked against `dev`, because none tests code.

/** @type {ReadonlySet<string>} */
export const READ_ONLY_LAB_COMMANDS = new Set(["inspect", "compare", "auth", "clone-cache", "flow-chart", "stop", "watch"]);
