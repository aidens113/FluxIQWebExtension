// The pair's command line: what `pnpm lab:pair` accepts and the options it
// becomes. A revision is handed to git, so one that could read as an option
// (a leading "-") or that holds a character no revision needs is refused here.

const REVISION = /^[A-Za-z0-9._/@{}^~][A-Za-z0-9._/@{}^~-]{0,199}$/u;
const INSTANCE = /^[a-z0-9][a-z0-9-]{0,63}$/u;

export const PAIR_USAGE = [
  "Usage: pnpm lab:pair [--ext REV] [--core REV] [--ext-root DIR] [--instance LABEL] [--build-core] [--allow-running] [--dry-run]",
  "  --ext REV, --core REV  move that side of the pair to REV, detached; an omitted side stays where it is",
  "  --ext-root DIR         the extension worktree (default <parent of this checkout>/fxlab/lab-ext); Core is the !FluxIQ beside it",
  "  --instance LABEL       the FLUXIQ_LAB_INSTANCE printed for campaigns (default lab-pair)",
  "  --build-core           rebuild Core's packages even when they were last built at this commit",
  "  --allow-running        move the pair although a running process is working inside it",
  "  --dry-run              print what would happen and change nothing",
].join("\n");

/** @param {string[]} argv */
export function parsePairArgs(argv) {
  const options = { ext: null, core: null, extRoot: null, instance: "lab-pair", buildCore: false, allowRunning: false, dryRun: false, help: false };
  const value = (index, name) => {
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) throw new Error(`${name} requires a value`);
    return next;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    // pnpm passes a separating `--` through to the script; it carries nothing here.
    if (arg === "--") continue;
    if (arg === "--ext" || arg === "--core") { options[arg.slice(2)] = revision(value(index, arg), arg); index += 1; }
    else if (arg === "--ext-root") { options.extRoot = value(index, arg); index += 1; }
    else if (arg === "--instance") { options.instance = instance(value(index, arg)); index += 1; }
    else if (arg === "--build-core") options.buildCore = true;
    else if (arg === "--allow-running") options.allowRunning = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown argument ${JSON.stringify(arg)}`);
  }
  return options;
}

function revision(text, name) {
  if (!REVISION.test(text)) throw new Error(`${name} ${JSON.stringify(text)} is not a revision this script will pass to git`);
  return text;
}

function instance(text) {
  if (!INSTANCE.test(text)) throw new Error(`--instance must be lowercase kebab-case, at most 64 characters; received ${JSON.stringify(text)}`);
  return text;
}
