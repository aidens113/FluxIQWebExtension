// Whether a change to Core's record post-processing alone -- a tier-1
// correction, the reads and actions left as they were -- could turn rows a run
// already read into the oracle's answer.
//
// Core's post-processing (`recordOutput.process`: `where`, `dedupe`, `sort`,
// `limit`, `columns`) keeps, orders, cuts and drops stored columns. It can
// neither add a column the read never stored nor move a value from one column
// to another. So the expected answer is derivable from the stored rows only
// when every column the expectation requires is stored, and every expected
// record equals some stored row on all of those columns; then some keeping and
// ordering of the stored rows is the answer. When it is not, the reasons say
// which columns are missing and which stored columns hold another column's
// values -- a read bound to the wrong element, which only a change to the read
// (tier 2) can fix. Values are compared with the oracle's own rule
// (`extractedValueMatches`) and never returned.

import type { ExpectedExtraction } from "@fluxiq-web-extension/test-contracts";
import { extractedValueMatches, type ExtractedValueContext, type ExtractionRecord } from "../../run-expectations/index.js";
import type { Tier1Derivability } from "../types.js";

/** `context` is the run's scenario origin, as the oracle compares with it. */
export function tier1Derivability(rows: readonly ExtractionRecord[], entry: ExpectedExtraction, context?: ExtractedValueContext): Tier1Derivability {
  const expected = entry.records ?? [];
  const optional = new Set(entry.optionalFields ?? []);
  const required = [...new Set(expected.flatMap((record) => Object.keys(record)))].filter((column) => !optional.has(column));
  const stored = [...new Set(rows.flatMap((row) => Object.keys(row).filter((column) => row[column] !== null && row[column] !== undefined)))];
  const missingColumns = required.filter((column) => !stored.includes(column));
  const shared = required.filter((column) => stored.includes(column));
  const equal = (wanted: string | null | undefined, actual: string | null | undefined): boolean => wanted !== undefined && actual !== undefined && extractedValueMatches(wanted, actual, context);
  const coveredOnSharedColumns = expected.filter((record) => rows.some((row) => shared.every((column) => equal(record[column], row[column])))).length;
  const holding = (from: string, to: string): number => expected.filter((record) => record[to] !== null && rows.some((row) => equal(record[to], row[from]))).length;
  const columnsHoldingOther = stored.flatMap((column) => {
    const own = required.includes(column) ? holding(column, column) : 0;
    const best = required.filter((other) => other !== column).map((other) => ({ other, count: holding(column, other) })).sort((left, right) => right.count - left.count)[0];
    return best && best.count > own ? [Object.freeze({ stored: column, holds: best.other, expectedRecords: best.count })] : [];
  });
  const derivable = expected.length > 0 && missingColumns.length === 0 && coveredOnSharedColumns === expected.length;
  const reasons: string[] = [];
  if (!derivable) {
    if (expected.length === 0) reasons.push("the expectation lists no records, so no stored row can be shown to be one of them");
    if (missingColumns.length) reasons.push(`no stored row carries ${missingColumns.join(", ")}: the read never stored ${missingColumns.length === 1 ? "that column" : "those columns"}, and post-processing cannot add one`);
    for (const held of columnsHoldingOther) reasons.push(`the stored ${held.stored} column holds the expected ${held.holds} values for ${held.expectedRecords} of ${expected.length} expected records: the read bound ${held.stored} to the element ${held.holds} is read from, and post-processing cannot move a value between columns`);
    if (expected.length && coveredOnSharedColumns < expected.length) reasons.push(`${expected.length - coveredOnSharedColumns} of ${expected.length} expected records equal no stored row on the ${shared.length} column(s) both sides carry`);
  }
  return Object.freeze({
    derivable,
    storedRows: rows.length,
    expectedRecords: expected.length,
    missingColumns: Object.freeze(missingColumns),
    coveredOnSharedColumns,
    columnsHoldingOther: Object.freeze(columnsHoldingOther),
    reasons: Object.freeze(reasons),
  });
}
