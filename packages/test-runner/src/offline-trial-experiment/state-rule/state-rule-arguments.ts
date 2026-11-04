// The `state-rule` command's arguments. It reads saved traces and starts nothing: no
// model, no site, no browser.

import { freshStoreCopyRefusal } from "../run/index.js";

export const STATE_RULE_USAGE = [
  "usage: offline-trial-experiment/cli.js state-rule --lab-runs <lab-runs dir> --work <dir under test-runs/> [--extra-store <project.sqlite>@<run id>]... [--out <json file>] [--tables <markdown file>]",
  "       offline-trial-experiment/cli.js state-rule --store <project.sqlite> --run <lab run dir> --work <dir under test-runs/> [--out <json file>] [--tables <markdown file>]",
].join("\n");

export type StateRuleArguments = Readonly<{
  /** Every run under this folder, each matched to the stores its instance kept. */
  labRuns: string | null;
  /** One store and the Lab run whose verdicts judge it. */
  store: string | null;
  run: string | null;
  /** Stores kept elsewhere (a copy of one a later run reused), each naming its run, since windows of runs in other lanes overlap. */
  extraStores: readonly Readonly<{ store: string; runId: string }>[];
  work: string;
  out: string | null;
  tables: string | null;
}>;

export function parseStateRuleArguments(argv: readonly string[]): StateRuleArguments | { error: string } {
  const single = new Map<string, string>();
  const extraStores: { store: string; runId: string }[] = [];
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]!;
    const value = argv[index + 1];
    if (!name.startsWith("--") || value === undefined || value.startsWith("--")) return { error: `${name} needs a value` };
    if (name === "--extra-store") {
      const at = value.lastIndexOf("@");
      if (at <= 0 || at === value.length - 1) return { error: "--extra-store is <project.sqlite>@<run id>" };
      extraStores.push({ store: value.slice(0, at), runId: value.slice(at + 1) });
    }
    else if (["--lab-runs", "--store", "--run", "--work", "--out", "--tables"].includes(name)) single.set(name.slice(2), value);
    else return { error: `${name} is not an argument` };
  }
  const work = single.get("work");
  if (work === undefined) return { error: "--work is required: only a copy of a store is ever opened" };
  const refused = freshStoreCopyRefusal(work);
  if (refused !== null) return { error: refused };
  const labRuns = single.get("lab-runs") ?? null;
  const store = single.get("store") ?? null;
  const run = single.get("run") ?? null;
  if ((labRuns === null) === (store === null)) return { error: "name exactly one of --lab-runs and --store" };
  if (store !== null && run === null) return { error: "--store needs --run, the Lab run whose verdicts judge it" };
  if (run !== null && store === null) return { error: "--run goes with --store" };
  return Object.freeze({ labRuns, store, run, extraStores: Object.freeze(extraStores), work, out: single.get("out") ?? null, tables: single.get("tables") ?? null });
}
