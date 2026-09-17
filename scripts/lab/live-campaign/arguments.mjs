// The campaign's command line: what `pnpm lab:campaign` accepts and the options
// it becomes. Lab options go after `--` and pass through untouched, except the
// ones the campaign sets itself for each task, which are refused there.

const KINDS = ["form", "navigate", "extract", "navigate-and-extract", "repair"];
const KEBAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const CAMPAIGN_OWNED_OPTIONS = new Set(["--live-llm", "--llm-task", "--llm-profile", "--llm-provider", "--llm-model", "--instruction-task", "--variant", "--workflow", "--flow"]);

export const CAMPAIGN_USAGE = "Usage: pnpm lab:campaign [task-id ...] [--kind form|navigate|extract|navigate-and-extract|repair[,...]] [--all] [--limit N] [--dry-run] [--no-build] [--max-attempts N] [--llm-profile ID (default lab-create-flow, or lab-adapt-repair for repair tasks)] [--llm-provider NAME] [--llm-model NAME] [--output DIR] [-- LAB-OPTIONS]";

/** @param {string[]} argv */
export function parseCampaignArgs(argv) {
  const options = { taskIds: [], kinds: [], all: false, limit: undefined, dryRun: false, build: true, maxAttempts: 3, profile: undefined, provider: "deepseek", model: "deepseek-chat", output: undefined, labArgs: [], help: false };
  const value = (index, name) => { const next = argv[index + 1]; if (next === undefined || next.startsWith("--")) throw new Error(`${name} requires a value`); return next; };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") { options.labArgs = argv.slice(index + 1); break; }
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--no-build") options.build = false;
    else if (arg === "--all") options.all = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--kind") { options.kinds.push(...value(index, arg).split(",")); index += 1; }
    else if (arg === "--limit") { options.limit = boundedInteger(value(index, arg), arg, 1, 10_000); index += 1; }
    else if (arg === "--max-attempts") { options.maxAttempts = boundedInteger(value(index, arg), arg, 1, 5); index += 1; }
    else if (arg === "--llm-profile") { options.profile = value(index, arg); index += 1; }
    else if (arg === "--llm-provider") { options.provider = value(index, arg); index += 1; }
    else if (arg === "--llm-model") { options.model = value(index, arg); index += 1; }
    else if (arg === "--output") { options.output = value(index, arg); index += 1; }
    else if (arg.startsWith("-")) throw new Error(`Unknown option ${arg}; Lab options go after --`);
    else if (!KEBAB_ID.test(arg)) throw new Error(`Task id ${JSON.stringify(arg)} is not kebab-case`);
    else options.taskIds.push(arg);
  }
  const unknownKinds = options.kinds.filter((kind) => !KINDS.includes(kind));
  if (unknownKinds.length > 0) throw new Error(`Unknown --kind ${unknownKinds.join(", ")}; expected one of ${KINDS.join(", ")}`);
  if (options.taskIds.length > 0 && (options.kinds.length > 0 || options.all)) throw new Error("Select tasks by id, or by --kind, or with --all: not by more than one");
  if (options.kinds.length > 0 && options.all) throw new Error("--kind already selects; drop --all");
  const owned = options.labArgs.filter((arg) => CAMPAIGN_OWNED_OPTIONS.has(arg));
  if (owned.length > 0) throw new Error(`The campaign sets ${owned.join(", ")} itself, per task; remove it after --`);
  return options;
}

function boundedInteger(text, name, min, max) {
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return parsed;
}
