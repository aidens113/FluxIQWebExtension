// The offline-trial experiment's command line, read into one value
// (`./cli.ts` documents each argument). A missing or contradictory argument is
// refused with the usage text rather than guessed at.

import { freshStoreCopyRefusal } from "./run/index.js";

export type ExperimentArguments = Readonly<{
  command: "survey" | "trial";
  /** The copied workspace's `.fluxiq` directory. */
  store: string;
  project: string;
  steps: string;
  scenario: string;
  task: string;
  /** The brief whose revisions are named. */
  brief: string;
  /** The revision a tier-1 correction starts from, and whose rows the survey's derivability reads. */
  fromRevision: number;
  out: string | null;
  /** trial: the source trace the offline trial runs against. */
  trace: string | null;
  /** trial: a recorded revision to run, rebuilt and digest-verified. */
  revision: number | null;
  /** trial: a JSON file holding the corrected `recordOutput.process`, for a hand tier-1 correction of `fromRevision`. */
  process: string | null;
  /** trial: the labelled step whose record processing the correction replaces. */
  stepLabel: string;
  /** trial: where the full request (candidate plan included) is written; must lie under a `test-runs` directory. */
  requestOut: string | null;
  /**
   * trial: an empty directory under `test-runs/` the offline trial runs in. The
   * store `--store` names is copied there first and only the copy is opened.
   * Without it the trial is prepared on `--store` and not run.
   */
  work: string | null;
  /**
   * trial: the session view supplied to Core's runner. `none` (default):
   * nothing, so a trace that recorded no view is refused; `declared`: the
   * extension's declared view (`./run/declared-session-view.ts`), which Core
   * uses only where the trace recorded none and reports as `supplied`.
   */
  sessionView: "declared" | "none";
  /**
   * trial: tier 2 (P5). The domain's offline reevaluator over a headed snapshot
   * page running the extension's production content code is handed to Core's
   * runner, so a changed read may be answered from the trace's recorded page
   * snapshot instead of ending the match.
   */
  tier2: boolean;
  /** trial with --tier2: the installed browser the snapshot page runs in. */
  channel: "chrome" | "msedge";
}>;

export const EXPERIMENT_USAGE = [
  "usage: offline-trial-experiment/cli.js survey --store <.fluxiq dir> --project <id> --steps <lab steps dir> [--scenario <id>] [--task <id>] [--brief <id>] [--from-revision <n>] [--out <file>]",
  "       offline-trial-experiment/cli.js trial  --store <.fluxiq dir> --project <id> --steps <lab steps dir> --trace <source trace id>",
  "                                              (--revision <n> | --process <process.json> [--from-revision <n>] [--step-label <label>])",
  "                                              [--brief <id>] [--request-out <file under test-runs/>] [--work <new dir under test-runs/>] [--session-view declared|none]",
  "                                              [--tier2 [--channel chrome|msedge]] [--out <file>]",
].join("\n");

/** Arguments that take no value: present or absent. */
const FLAGS: ReadonlySet<string> = new Set(["tier2"]);

const DEFAULTS = { scenario: "social-network-feed", task: "social-network-feed-recent-group-posts", brief: "brief-1", fromRevision: 10, stepLabel: "posts" };

export function parseExperimentArguments(argv: readonly string[]): ExperimentArguments | { error: string } {
  const [command, ...rest] = argv;
  if (command !== "survey" && command !== "trial") return { error: `the first argument is the command, survey or trial, not ${command ?? "nothing"}` };
  const options = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 1) {
    const name = rest[index]!;
    if (FLAGS.has(name.slice(2)) && name.startsWith("--")) {
      options.set(name.slice(2), "true");
      continue;
    }
    const value = rest[index + 1];
    if (!name.startsWith("--") || value === undefined || value.startsWith("--")) return { error: `${name} needs a value` };
    options.set(name.slice(2), value);
    index += 1;
  }
  const known = new Set(["store", "project", "steps", "scenario", "task", "brief", "from-revision", "out", "trace", "revision", "process", "step-label", "request-out", "work", "session-view", "tier2", "channel"]);
  const unknown = [...options.keys()].find((name) => !known.has(name));
  if (unknown !== undefined) return { error: `--${unknown} is not an argument` };
  for (const required of ["store", "project", "steps"]) if (!options.has(required)) return { error: `--${required} is required` };
  const whole = (name: string, fallback: number | null): number | null | { error: string } => {
    const value = options.get(name);
    if (value === undefined) return fallback;
    return /^\d+$/.test(value) ? Number(value) : { error: `--${name} is a whole number` };
  };
  const fromRevision = whole("from-revision", DEFAULTS.fromRevision);
  const revision = whole("revision", null);
  if (fromRevision !== null && typeof fromRevision === "object") return fromRevision;
  if (revision !== null && typeof revision === "object") return revision;
  if (command === "trial") {
    if (!options.has("trace")) return { error: "trial needs --trace, the source trace the offline trial runs against" };
    if ((revision === null) === !options.has("process")) return { error: "trial needs exactly one candidate: --revision <n>, or --process <file> for a tier-1 correction" };
    const view = options.get("session-view");
    if (view !== undefined && view !== "declared" && view !== "none") return { error: "--session-view is declared or none" };
    const work = options.get("work");
    const refused = work === undefined ? null : freshStoreCopyRefusal(work);
    if (refused !== null) return { error: refused };
    const channel = options.get("channel");
    if (channel !== undefined && channel !== "chrome" && channel !== "msedge") return { error: "--channel is chrome or msedge" };
    if (channel !== undefined && !options.has("tier2")) return { error: "--channel chooses tier 2's browser: it needs --tier2" };
    if (options.has("tier2") && work === undefined) return { error: "--tier2 runs the trial: it needs --work" };
  } else if (options.has("work") || options.has("session-view") || options.has("tier2") || options.has("channel")) {
    return { error: "--work, --session-view, --tier2 and --channel are trial arguments: survey reads --store and runs nothing" };
  }
  return Object.freeze({
    command,
    store: options.get("store")!, project: options.get("project")!, steps: options.get("steps")!,
    scenario: options.get("scenario") ?? DEFAULTS.scenario, task: options.get("task") ?? DEFAULTS.task, brief: options.get("brief") ?? DEFAULTS.brief,
    fromRevision: fromRevision ?? DEFAULTS.fromRevision,
    out: options.get("out") ?? null, trace: options.get("trace") ?? null, revision,
    process: options.get("process") ?? null, stepLabel: options.get("step-label") ?? DEFAULTS.stepLabel,
    requestOut: options.get("request-out") ?? null, work: options.get("work") ?? null, sessionView: options.get("session-view") === "declared" ? "declared" : "none",
    tier2: options.has("tier2"), channel: options.get("channel") === "msedge" ? "msedge" : "chrome",
  });
}
