// The rows two or more of a read's `where` conditions left out together, for a
// replayed read's `readRows` (t655).
//
// A condition's `leftOutOnlyByThis` names the rows it removed by itself
// (`../replay-answer.ts`); a row two conditions both rejected is named under
// neither, so a read's labels never covered every row it saw. Core's test of
// whether they do (its `result-verification/refuted-no/record.ts`, t654) failed
// on every judged trial of A8 frozen pair 5 (`run-mva6mlm4-97fe42f9`: seen 23,
// kept 9, 12 left out alone). So each such row is named here once, under every
// condition it failed, by its label alone: no one condition's tested value is
// the reason it is out.
//
// **From the page's own lists.** Each condition's rejected rows lead with the
// ones it removed alone (`rejectedSamplesAlone` says how many); the rest of its
// list are rows another condition rejected too. A row is the same row wherever
// its values are the same, as the page already says an identical row once
// (`../rejected-rows.ts` groups an explored read's `rowsWithOthers` the same
// way). A page that did not order its lists, or a read asked only for each
// condition's alone rows, sends none of these, and none is said. A row found
// under fewer than two conditions is not said either: its conditions would be
// a guess.
//
// **Withheld as an alone row is.** The label is written by the caller's own
// labeller, the one `leftOutOnlyByThis` uses, so a denied column is never a
// label and a credential-shaped label is written withheld.

import type { JsonObject } from "fluxiq/core";
import type { WebAutomationExtractionRejectedRow } from "../../../../actions/extraction";

/** One set of conditions and the rows that failed exactly those: Core's `readRows.leftOutTogether` entry. */
export type WebNodeReplayLeftOutTogether = { conditions: string[]; conditionIndexes: number[]; rows: JsonObject[] };

/**
 * Each set of conditions that left rows out together, in the order of their
 * 0-based places, with every such row once, labelled by `label` (header).
 * `named` is each condition's name, positionally.
 */
export function webNodeReplayLeftOutTogether(
  samples: readonly (readonly WebAutomationExtractionRejectedRow[])[] | undefined,
  leads: readonly number[] | undefined,
  named: readonly string[],
  label: (row: WebAutomationExtractionRejectedRow) => JsonObject[]
): WebNodeReplayLeftOutTogether[] {
  if (samples === undefined || leads === undefined) return [];
  const byRow = new Map<string, { row: WebAutomationExtractionRejectedRow; failed: number[] }>();
  samples.forEach((sampled, index) => {
    const lead = leads[index];
    if (lead === undefined) return;
    for (const row of sampled.slice(lead)) {
      const key = JSON.stringify(row);
      const said = byRow.get(key) ?? { row, failed: [] };
      if (!said.failed.includes(index)) said.failed.push(index);
      byRow.set(key, said);
    }
  });
  const bySet = new Map<string, WebNodeReplayLeftOutTogether>();
  for (const { row, failed } of byRow.values()) {
    if (failed.length < 2) continue;
    const rows = label(row);
    if (!rows.length) continue;
    const key = failed.join(",");
    const set = bySet.get(key) ?? { conditions: failed.map((index) => named[index] ?? `condition ${index + 1}`), conditionIndexes: [...failed], rows: [] };
    set.rows.push(...rows);
    bySet.set(key, set);
  }
  return [...bySet.values()].sort((a, b) => compareSets(a.conditionIndexes, b.conditionIndexes));
}

function compareSets(a: readonly number[], b: readonly number[]): number {
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return a.length - b.length;
}
