// The rows each `where` condition rejected, kept while the read goes on, for a
// read that was asked for them.
//
// Only the exploring model's own node run asks (the command's
// `rejectedSamples: true`, `domain/src/actions/extraction/rejected-samples.ts`),
// because counts alone cannot show it a condition that removes true answers:
// on `run-munq5s8x-6d620cdf` an accessory rule rejected three earbuds named
// "... Wireless Charging Case ..." and the model saw only `16`. A playback
// never asks, so nothing here reaches a stored result.
//
// **Every rejected row, every value whole** (user, 2026-09-30: "Remove ANY AND
// ALL LIMITS ON THE NUMBER OF ELEMENTS PASSED TO MODEL. DO NOT HIDE
// INFORMATION"). There is no row count and no character cut. The one thing
// not added is a row a condition already holds: an identical row is said once,
// so a page shown twice does not say one row twice. A row several conditions
// rejected is a row of each. The rows carry across documents with the read's
// checkpoint (`shared/extraction-continuation.ts`), whole.
//
// **The rows a condition removed by itself come first, and are counted.** A row
// that also failed another condition would have been left out without this one,
// so it says nothing about whether this condition is right. On
// `run-mup2u8o3-6697c4be` the accessory rule rejected 20 rows, 17 of which also
// failed price, rating or Plus; the 5 it removed alone were two accessories and
// the 3 true earbuds named "... with Wireless Charging Case", which shows the rule
// is wrong at a glance where the 20 hide it. So each condition's list is its
// alone rows, then the rest, and `alone()` says how many lead it. A row said
// once is said in the more telling place: one first seen beside another
// condition and later seen alone moves to the alone rows.
//
// Screening happens where the rows become evidence: the domain's node run puts
// them through the same screen as the kept rows
// (`domain/src/runtime/llm-evidence/node-run/rejected-rows.ts`).

import type { ExtractedListRecord } from "./list-reader";

/** The rows a read is keeping: `note` each rejection, `rows` and `alone` for the checkpoint and the outcome. */
export type RejectedSamples = {
  /** One rejected item: every condition that rejected it, by position in `where`. */
  note(rejectedBy: readonly number[], record: ExtractedListRecord): void;
  /** One list per condition: the rows it removed alone, then the rows another condition also rejected. */
  rows(): ExtractedListRecord[][];
  /** Per condition, how many of the leading rows of its list it removed alone. */
  alone(): number[];
};

/** One condition's rows, in its two groups, with where each said row is. */
type ConditionRows = { alone: ExtractedListRecord[]; withOthers: ExtractedListRecord[]; placed: Map<string, "alone" | "withOthers"> };

/**
 * A collector for `conditions` conditions, starting from what a continued read
 * carried when it has one list per condition, or `undefined` for a read that
 * was not asked for its rejected rows or names no conditions. `carriedAlone` is
 * how many leading rows of each carried list were removed alone; a checkpoint
 * from a page build that did not say counts none of them alone.
 */
export function rejectedSamplesFor(
  asked: boolean,
  conditions: number,
  carried: readonly ExtractedListRecord[][] | undefined,
  carriedAlone?: readonly number[] | undefined
): RejectedSamples | undefined {
  if (!asked || conditions === 0) return undefined;
  const fits = carried?.length === conditions;
  const lists: ConditionRows[] = Array.from({ length: conditions }, (_unused, index) => {
    const rows = fits ? (carried[index] ?? []).map(copy) : [];
    const lead = carriedAlone?.length === conditions ? Math.min(carriedAlone[index] ?? 0, rows.length) : 0;
    const list: ConditionRows = { alone: rows.slice(0, lead), withOthers: rows.slice(lead), placed: new Map() };
    for (const row of list.alone) list.placed.set(keyOf(row), "alone");
    for (const row of list.withOthers) if (!list.placed.has(keyOf(row))) list.placed.set(keyOf(row), "withOthers");
    return list;
  });
  return {
    note(rejectedBy, record) {
      const alone = rejectedBy.length === 1;
      for (const index of rejectedBy) {
        const list = lists[index];
        if (list === undefined) continue;
        const row = copy(record);
        const key = keyOf(row);
        const placed = list.placed.get(key);
        if (placed === "alone" || (placed === "withOthers" && !alone)) continue;
        if (placed === "withOthers") list.withOthers = list.withOthers.filter((kept) => keyOf(kept) !== key);
        list.placed.set(key, alone ? "alone" : "withOthers");
        (alone ? list.alone : list.withOthers).push(row);
      }
    },
    rows: () => lists.map((list) => [...list.alone, ...list.withOthers].map(copy)),
    alone: () => lists.map((list) => list.alone.length)
  };
}

function keyOf(record: ExtractedListRecord): string {
  return JSON.stringify(record);
}

function copy(record: ExtractedListRecord): ExtractedListRecord {
  return { ...record };
}
