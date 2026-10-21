// The `reads` command's arguments (the P5 changed-read gate tool; `../cli.ts`
// documents each), read into one value. A missing or malformed argument is
// refused with the reason rather than guessed at.

import { freshStoreCopyRefusal } from "../run/index.js";
import type { NamedReadPair } from "./run-reads-gate.js";

export type ReadsArguments = Readonly<{
  /** The copied workspace's `.fluxiq` directory; it is copied to `work` and never opened itself. */
  store: string;
  project: string;
  /** A new directory under `test-runs/` the store is copied into. */
  work: string;
  pairs: "strict" | "same_snapshot" | "none";
  named: readonly NamedReadPair[];
  onePerFields: number | null;
  fidelity: boolean;
  channel: "chrome" | "msedge";
  out: string | null;
}>;

export const READS_USAGE = [
  "usage: offline-trial-experiment/cli.js reads --store <.fluxiq dir> --project <id> --work <new dir under test-runs/>",
  "                                              [--pairs strict|same-snapshot|none] [--pair-list <trace>@<seq>/<trace>@<seq>,...]",
  "                                              [--one-per-fields <cap>] [--fidelity all|none] [--channel chrome|msedge] [--out <file>]",
].join("\n");

const KNOWN = new Set(["store", "project", "work", "pairs", "pair-list", "one-per-fields", "fidelity", "channel", "out"]);
const PAIR = /^([0-9a-z.-]+)@(\d+)\/([0-9a-z.-]+)@(\d+)$/u;

export function parseReadsArguments(argv: readonly string[]): ReadsArguments | { error: string } {
  const options = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]!;
    const value = argv[index + 1];
    if (!name.startsWith("--") || value === undefined || value.startsWith("--")) return { error: `${name} needs a value` };
    if (!KNOWN.has(name.slice(2))) return { error: `${name} is not an argument of reads` };
    options.set(name.slice(2), value);
  }
  for (const required of ["store", "project", "work"]) if (!options.has(required)) return { error: `--${required} is required` };
  const refused = freshStoreCopyRefusal(options.get("work")!);
  if (refused !== null) return { error: refused };
  const pairs = options.get("pairs") ?? "strict";
  if (pairs !== "strict" && pairs !== "same-snapshot" && pairs !== "none") return { error: "--pairs is strict, same-snapshot or none" };
  const named: NamedReadPair[] = [];
  for (const entry of (options.get("pair-list") ?? "").split(",").filter((part) => part !== "")) {
    const match = PAIR.exec(entry);
    if (match === null) return { error: "--pair-list is a comma-separated list of trace@sequence/trace@sequence" };
    named.push(Object.freeze({ a: Object.freeze({ trace: match[1]!, sequence: Number(match[2]) }), b: Object.freeze({ trace: match[3]!, sequence: Number(match[4]) }) }));
  }
  const cap = options.get("one-per-fields");
  if (cap !== undefined && !/^\d+$/u.test(cap)) return { error: "--one-per-fields is a whole number" };
  const fidelity = options.get("fidelity") ?? "all";
  if (fidelity !== "all" && fidelity !== "none") return { error: "--fidelity is all or none" };
  const channel = options.get("channel") ?? "chrome";
  if (channel !== "chrome" && channel !== "msedge") return { error: "--channel is chrome or msedge" };
  return Object.freeze({
    store: options.get("store")!, project: options.get("project")!, work: options.get("work")!,
    pairs: pairs === "same-snapshot" ? "same_snapshot" : pairs, named: Object.freeze(named),
    onePerFields: cap === undefined ? null : Number(cap), fidelity: fidelity === "all", channel, out: options.get("out") ?? null,
  });
}
