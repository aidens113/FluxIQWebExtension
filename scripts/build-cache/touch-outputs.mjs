// Moves a reused step's output timestamps to now.
//
// Several guards decide staleness by modification time -- the Lab's
// `domain-build-staleness.mjs` compares the newest source file against the
// newest output file. A reuse is exactly as current as a rebuild, so after one
// every output root and every required file carries the current time and those
// guards agree with the cache. Contents are untouched, so no output digest or
// dependant's fingerprint changes.

import { existsSync } from "node:fs";
import { utimes } from "node:fs/promises";

/** @param {{ outputs: { path: string }[], required: string[] }} resolved */
export async function touchOutputs(resolved) {
  const now = new Date();
  for (const target of [...resolved.outputs.map((output) => output.path), ...resolved.required]) {
    if (existsSync(target)) await utimes(target, now, now);
  }
}
