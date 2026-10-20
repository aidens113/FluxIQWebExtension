// The order a list read answers in, and which of its rows count as one:
// `dedupe` and `sort` of a `web.dom.extract_list` request, applied by the page.
//
// **One order, and it is the contract's** (`domain/src/actions/extraction/request.ts`):
// `where`, then `dedupe`, then `sort`, then `maxItems`. `where` is
// `item-filter.ts`'s and runs as each item is read. The rest is here, and the
// list reader asks it twice:
//
// - `identity` as each kept row is read, so a duplicate never takes a place
//   under `maxItems` and the read goes on to the next distinct row;
// - `apply` once, over every row the read answers with, which dedupes again
//   (a no-op for rows `identity` already let through, and the whole of it for
//   the rows `filtered-answer.ts` falls back to), sorts, and only then cuts to
//   `maxItems` -- so "the five newest" is the five newest of every row read,
//   not the newest of the first five.
//
// **Until 2026-09-28 a request could say both and the page did neither.** The
// domain read them, validated them and named them in the catalog; nothing here
// looked at them, so a repair that wrote "newest first" got page order back,
// saw an unchanged answer and stopped as not converging
// (`docs/working/language-driven-flow-loop-plan/reports/inflight-audit-0928.md`).
//
// **A value that cannot be read sorts last, and is counted.** A row whose value
// for a key is absent, blank, or does not state that key's type, goes after
// every row that does, whichever the direction, and ties among such rows fall to
// the next key and then to page order. `unsortable` counts the rows with at
// least one such key, so a sort over a column the page states as prose is
// visible as one rather than looking like page order that happened to be right.
//
// **How a value is read, compared and identified is Core's**
// (`fluxiq/automation-studio/nodes`): `automationStudioRecordRowIdentity` is the
// dedupe identity, `sortAutomationStudioRecordRows` the order and
// `countAutomationStudioRecordUnsortableRows` the count, the same functions
// Core's dataset processing runs over collected rows, so a list read sorted on
// the page and a dataset sorted at run end agree. A number reads as a `where`
// bound reads one (`$1,299.00` is 1299, `EUR 169,00` is 169, `£72k` is 72000);
// `auto` reads a column as dates when most of its values state one, as numbers
// when most state one, and as text otherwise; a date may be relative to the read
// ("3 days ago", "yesterday", "5h left"), and one written without a year is the
// occurrence nearest the read. Core's tests pin those readings. What stays here
// is binding the request to the columns this read reads, and the bound.

import {
  automationStudioRecordRowIdentity,
  countAutomationStudioRecordUnsortableRows,
  sortAutomationStudioRecordRows,
  type AutomationStudioRecordSortKey
} from "fluxiq/automation-studio/nodes";
import type { WebAutomationExtractListRequest } from "../types";

type Row = Readonly<Record<string, string | null>>;
type SortKey = NonNullable<WebAutomationExtractListRequest["sort"]>[number];

/** What `dedupe` and `sort` did to a read, in counts alone; `0` for the half the request did not name. */
export type ListExtractionOrderReport = { duplicates: number; unsortable: number };

/** The rows in answer order, cut to the bound, and what that took. */
export type OrderedRows<T extends Row> = { rows: T[]; duplicates: number; unsortable: number; cut: boolean };

/** A request's dedupe and sort, bound to the columns the read actually reads. */
export type ListRowOrder = {
  /** Whether the request sorts, which makes `maxItems` a bound on the answer rather than on the read. */
  sorts: boolean;
  /** The row's dedupe identity, or `undefined` for a request that dedupes nothing and for a row that cannot be identified. */
  identity(row: Row): string | undefined;
  /** Dedupe, sort, then cut to `bound`. */
  apply<T extends Row>(rows: readonly T[], bound: number, now?: number): OrderedRows<T>;
};

/**
 * The order a request asks for, over the columns the read reads (`fieldNames`,
 * excluded fields left out), or `undefined` for a request that names neither
 * `dedupe` nor `sort` -- or names only columns the read does not read, which
 * the domain's reader already resolved away and this refuses to guess at.
 */
export function listRowOrderFor(request: Pick<WebAutomationExtractListRequest, "dedupe" | "sort">, fieldNames: readonly string[]): ListRowOrder | undefined {
  const readable = new Set(fieldNames);
  const by = request.dedupe === undefined ? undefined : unique(request.dedupe.by.filter((name) => readable.has(name)));
  // A dedupe whose every column is gone still means "list each once", so it
  // falls back to the whole row rather than to nothing, as the domain's reader
  // does for a dedupe that names no column at all.
  const dedupeBy = by === undefined ? undefined : by.length > 0 ? by : [...fieldNames];
  const sort = (request.sort ?? []).filter((key) => readable.has(key.field));
  if (dedupeBy === undefined && sort.length === 0) return undefined;
  const keys = sort.map(coreSortKey);
  const identity = (row: Row): string | undefined => (dedupeBy === undefined ? undefined : automationStudioRecordRowIdentity(row, dedupeBy));
  return {
    sorts: sort.length > 0,
    identity,
    apply<T extends Row>(rows: readonly T[], bound: number, now: number = Date.now()): OrderedRows<T> {
      const seen = new Set<string>();
      let duplicates = 0;
      const distinct = rows.filter((row) => {
        const id = identity(row);
        if (id === undefined) return true;
        if (seen.has(id)) {
          duplicates += 1;
          return false;
        }
        seen.add(id);
        return true;
      });
      const { rows: sorted, unsortable } = keys.length > 0 ? sortRows(distinct, keys, now) : { rows: distinct, unsortable: 0 };
      const limit = Math.max(0, bound);
      return { rows: sorted.slice(0, limit), duplicates, unsortable, cut: sorted.length > limit };
    }
  };
}

/** A request's sort key as Core reads one: `as` left out rather than `undefined`, which is what `auto` means. */
function coreSortKey(key: SortKey): AutomationStudioRecordSortKey {
  return key.as === undefined ? { field: key.field, order: key.order } : { field: key.field, order: key.order, as: key.as };
}

/** The rows in key order and how many had a key they could not be read by, through Core's sort over rows wrapped as `{ values }`. */
function sortRows<T extends Row>(rows: readonly T[], keys: readonly AutomationStudioRecordSortKey[], now: number): { rows: T[]; unsortable: number } {
  const wrapped = rows.map((row) => ({ row, values: row }));
  return {
    rows: sortAutomationStudioRecordRows(wrapped, keys, now).map((entry) => entry.row),
    unsortable: countAutomationStudioRecordUnsortableRows(wrapped, keys, now)
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
