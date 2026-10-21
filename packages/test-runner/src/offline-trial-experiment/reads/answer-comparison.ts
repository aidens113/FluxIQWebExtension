// A tier-2 answer -- or a read run over its own snapshot -- compared with what
// the read returned live (the P5 gate), on what the page decided:
// - the status and the failure code (absent on both sides counts as equal);
// - the records (`payload.extracted` as a list), position by position, each
//   compared by value (object keys in any order) and by its number of cells;
// - a value that is not a list, by value;
// - the extraction summary's counts (records, pages, items seen, empty
//   records, earlier-page repeats); a count on one side only differs.
// Never timings, command ids, the tab, addresses or trace references: the
// sandbox has its own clock and id and no tab. What comes back is counts,
// codes, positions and field names: nothing compared is copied into it.

import type { ReadAnswerComparison } from "./types.js";

const SUMMARY_COUNTS = ["recordCount", "pagesRead", "itemsSeen", "emptyRecords", "earlierPageRepeats"] as const;
const MAX_FIELDS = 10;

type Rows = NonNullable<ReadAnswerComparison["rows"]>;

export function compareReadAnswer(answer: unknown, live: unknown): ReadAnswerComparison {
  const answerResult = recordOf(answer);
  const liveResult = recordOf(live);
  const status = pair(stringOf(liveResult?.status), stringOf(answerResult?.status));
  const failureCode = pair(stringOf(recordOf(liveResult?.failure)?.code), stringOf(recordOf(answerResult?.failure)?.code));
  const livePayload = recordOf(liveResult?.payload);
  const answerPayload = recordOf(answerResult?.payload);
  const liveExtracted = livePayload?.extracted;
  const answerExtracted = answerPayload?.extracted;
  const rows = Array.isArray(liveExtracted) || Array.isArray(answerExtracted) ? compareRows(liveExtracted, answerExtracted) : null;
  const value = Array.isArray(liveExtracted) && Array.isArray(answerExtracted)
    ? null
    : Object.freeze({ live: kindOf(liveExtracted), answer: kindOf(answerExtracted), equal: sameValue(liveExtracted, answerExtracted) });
  const liveSummary = recordOf(livePayload?.extraction);
  const answerSummary = recordOf(answerPayload?.extraction);
  const differing = SUMMARY_COUNTS.filter((count) => liveSummary?.[count] !== answerSummary?.[count]);
  const summary = Object.freeze({ equal: differing.length === 0, differing });
  const rowsEqual = rows === null || (rows.live === rows.answer && rows.equalPositions === rows.live);
  return Object.freeze({
    equal: status.equal && failureCode.equal && rowsEqual && (value === null || value.equal) && summary.equal,
    status, failureCode, rows, value, summary,
  });
}

function compareRows(live: unknown, answer: unknown): Rows {
  const liveRows = Array.isArray(live) ? live : [];
  const answerRows = Array.isArray(answer) ? answer : [];
  const shared = Math.min(liveRows.length, answerRows.length);
  let equalPositions = 0;
  let cellCountsEqual = 0;
  let firstDifference: number | null = null;
  const differingFields = new Set<string>();
  for (let index = 0; index < Math.max(liveRows.length, answerRows.length); index += 1) {
    const left: unknown = liveRows[index];
    const right: unknown = answerRows[index];
    if (index < shared && sameValue(left, right)) equalPositions += 1;
    else firstDifference ??= index;
    if (index < shared && cellCount(left) === cellCount(right)) cellCountsEqual += 1;
    const leftRecord = recordOf(left);
    const rightRecord = recordOf(right);
    if (leftRecord === undefined || rightRecord === undefined) continue;
    for (const key of new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)])) {
      if (!sameValue(leftRecord[key], rightRecord[key])) differingFields.add(key);
    }
  }
  return Object.freeze({
    live: Array.isArray(live) ? liveRows.length : null,
    answer: Array.isArray(answer) ? answerRows.length : null,
    equalPositions, cellCountsEqual,
    cellsLive: liveRows.reduce((sum: number, row: unknown) => sum + cellCount(row), 0),
    cellsAnswer: answerRows.reduce((sum: number, row: unknown) => sum + cellCount(row), 0),
    firstDifference, differingFields: [...differingFields].sort().slice(0, MAX_FIELDS),
  });
}

function pair(live: string | null, answer: string | null): Readonly<{ live: string | null; answer: string | null; equal: boolean }> {
  return Object.freeze({ live, answer, equal: live === answer });
}

/** A record's cells: its fields that hold something; anything that is not a record is one cell. */
function cellCount(value: unknown): number {
  const record = recordOf(value);
  return record === undefined ? 1 : Object.values(record).filter((cell) => cell !== undefined).length;
}

function kindOf(value: unknown): string {
  if (value === undefined) return "absent";
  if (value === null) return "null";
  if (Array.isArray(value)) return "list";
  return typeof value;
}

/** Equal JSON values: arrays in order, objects by key whatever their order, an absent key equal to an undefined one. */
function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((entry, index) => sameValue(entry, right[index]));
  }
  const leftRecord = recordOf(left);
  const rightRecord = recordOf(right);
  if (leftRecord === undefined || rightRecord === undefined) return false;
  return [...new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)])].every((key) => sameValue(leftRecord[key], rightRecord[key]));
}

function stringOf(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
