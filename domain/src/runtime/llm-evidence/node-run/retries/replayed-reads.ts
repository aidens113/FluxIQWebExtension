// The list reads a build's test has replayed, so a row-bound step whose row
// went stale can re-run the read it came from (t786, D7).
//
// A replayed step of a loop's body arrives with its pass's row as `item`
// (`../replay.ts`) and nothing else about where that row came from: Core reads
// the rows off the read's replay answer and hands each pass one of them. So
// each list read a test replays is remembered here with the command it was sent
// with and the rows it answered, and the read a stale row came from is the one
// whose rows hold that very row. Nothing else is inferred: a row no remembered
// read answered has no source here, and the step's retries run as before.
//
// Kept per build and session, beside the build's handle stores (which live as
// long as the domain's evidence runtime does), for the last few reads of each
// build only, and never shown to anyone.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webNodeBuildOf, webNodeBuildSlot } from "../build-state";
import type { WebNodeRun } from "../context";

/** One replayed list read: the command it went out as, the parameters its rows are read back with, and its rows. */
export type WebNodeReplayedRead = { command: { actionType: string; parameters: JsonObject }; parameters: JsonObject; rows: readonly JsonObject[] };

export type WebNodeReplayedReads = {
  remember(read: WebNodeReplayedRead): void;
  /** The newest remembered read whose rows hold `row`, or nothing. */
  sourceOf(row: JsonObject): WebNodeReplayedRead | undefined;
};

/** Reads remembered per build. */
const READS_PER_BUILD = 4;
/** Builds remembered per evidence runtime. */
const BUILDS = 16;

const memory = new WeakMap<object, Map<string, WebNodeReplayedRead[]>>();

/** The replayed reads of the build `run` belongs to (header). */
export function webNodeReplayedReads(run: Pick<WebNodeRun, "stores" | "request" | "sessionId">): WebNodeReplayedReads {
  let builds = memory.get(run.stores.extractions);
  if (builds === undefined) {
    builds = new Map();
    memory.set(run.stores.extractions, builds);
  }
  const held = builds;
  const slot = `${webNodeBuildSlot(webNodeBuildOf(run.request).build)}\u0000${run.sessionId}`;
  return {
    remember(read) {
      const reads = [read, ...(held.get(slot) ?? [])].slice(0, READS_PER_BUILD);
      held.delete(slot);
      held.set(slot, reads);
      while (held.size > BUILDS) held.delete(held.keys().next().value!);
    },
    sourceOf(row) {
      const wanted = canonical(row);
      return held.get(slot)?.find((read) => read.rows.some((candidate) => canonical(candidate) === wanted));
    }
  };
}

/** A value as one string, keys in order, so two equal rows compare equal however their keys were written. */
function canonical(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key]!)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
