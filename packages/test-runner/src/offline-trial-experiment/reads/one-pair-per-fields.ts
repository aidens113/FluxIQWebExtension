// One pair per distinct differing-path set (the P5 gate's social sample): the
// first pair of each set of Core operation differences, in the order given,
// up to `cap` pairs.

import type { ReadPair } from "./types.js";

export function onePairPerFields(pairs: readonly ReadPair[], cap: number): ReadPair[] {
  const seen = new Set<string>();
  const kept: ReadPair[] = [];
  for (const pair of pairs) {
    if (kept.length >= cap) break;
    const set = [...pair.fields].sort().join("\n");
    if (seen.has(set)) continue;
    seen.add(set);
    kept.push(pair);
  }
  return kept;
}
