// The arguments of `pnpm lab watch`:
//   --from-steps <steps dir>   replay a finished run's step folders (read only)
//   --steps <steps dir>        follow a run in flight until interrupted
//   --evidence <dir>           where the alerts and heartbeat go (a replay's default is a temporary
//                              folder; a followed run's is the run's own folder)
// Returns `{ error }` for anything else, with the usage in it.

const USAGE = "usage: pnpm lab watch --from-steps <steps dir> [--evidence <dir>] | --steps <steps dir> [--evidence <dir>]";

/** @param {string[]} args the arguments after `watch` */
export function parseWatchArguments(args) {
  const parsed = { mode: null, stepsDirectory: null, evidenceDirectory: null };
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const value = args[index + 1];
    if (flag !== "--from-steps" && flag !== "--steps" && flag !== "--evidence") return { error: `unknown argument ${flag}. ${USAGE}` };
    if (value === undefined || value.startsWith("--")) return { error: `${flag} needs a folder. ${USAGE}` };
    index += 1;
    if (flag === "--evidence") parsed.evidenceDirectory = value;
    else if (parsed.mode !== null) return { error: `give one of --from-steps and --steps. ${USAGE}` };
    else {
      parsed.mode = flag === "--from-steps" ? "replay" : "watch";
      parsed.stepsDirectory = value;
    }
  }
  if (parsed.mode === null) return { error: USAGE };
  return parsed;
}
