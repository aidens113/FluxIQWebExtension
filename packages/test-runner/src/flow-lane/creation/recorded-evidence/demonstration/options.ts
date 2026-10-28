// The command-line side of the recorded-evidence lane (t770-D1): `--demonstration <id>` and
// `--demonstration-probe`, checked where the command is parsed so a refusal costs nothing.
//
// A demonstration is recorded in the real extension and attached to the chat message that carries
// the task's instruction, so it is only meaningful for a chat build of exactly the task it was
// written for. The refusals that need the catalog (an unknown id, a task or scenario that does not
// match, a conflicting demonstration) are `selectDemonstration`'s, which runs once the catalog is
// loaded; these are the ones the arguments alone decide.

/** What the two options add to a parsed `lab run`. */
export type DemonstrationOptions = Readonly<{ demonstrationId?: string; demonstrationProbe?: true }>;

const KEBAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/**
 * `args` have had `--demonstration-probe` removed (it takes no value) and say whether it was there.
 * `live` is whether `--live-llm` was given; without it only `--dry-run` may follow a demonstration,
 * since a build needs a model and a dry run is the one thing that needs none.
 */
export function demonstrationOptions(
  args: readonly string[],
  flags: Readonly<{ probe: boolean; dryRun: boolean; directApiBuild: boolean; instructionTaskId: string | undefined; live: boolean }>,
): DemonstrationOptions {
  const indexes = args.flatMap((value, index) => (value === "--demonstration" ? [index] : []));
  if (indexes.length > 1) throw new Error("--demonstration may only be specified once");
  const index = indexes[0];
  if (index === undefined) {
    if (flags.probe) throw new Error("--demonstration-probe requires --demonstration");
    return {};
  }
  const id = args[index + 1];
  if (id === undefined || id.startsWith("--")) throw new Error("--demonstration requires a value");
  if (!KEBAB_ID.test(id)) throw new Error("--demonstration must be a lowercase kebab-case demonstration ID");
  if (flags.instructionTaskId === undefined) throw new Error("--demonstration requires --instruction-task: a recording is attached to the message that carries one task's instruction");
  if (flags.directApiBuild) throw new Error("--demonstration cannot be combined with --direct-api-build: the recording is attached in the extension's chat, which a direct build never opens");
  if (!flags.live && !flags.dryRun) throw new Error("--demonstration builds from the chat and needs --live-llm --llm-task create-flow, or --dry-run for the provider-free check that records, attaches and judges it without sending");
  return { demonstrationId: id, ...(flags.probe ? { demonstrationProbe: true as const } : {}) };
}
