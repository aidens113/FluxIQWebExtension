// The extract-list verb: read a repeating structure into records.
//
// The records become the result's `extracted`; the post-condition is that at
// least `minItems` records were read and every record carries every declared
// field. Either shortfall is a failed validation -- `output_not_observed` --
// because an empty list or a record list that quietly dropped a column looks
// exactly like a successful extraction to everything downstream. `minItems`
// defaults to 1 (decision D4): a workflow where an empty list is a valid
// answer says so with `minItems: 0`. An empty list on a sign-in gate is
// reported as `auth_required` by `results.ts`, which sees every result.
//
// The command's `timeoutMs` bounds the whole read. Running out of it is a
// `timed_out` result carrying the records and page count that were read, and
// no promise about which page is showing (decision D5).
//
// The capability is awaited here and its throws are caught here, which is belt
// and braces: `execute.ts` awaits every branch, so its catch would report a
// rejection from this verb anyway. The local catch is kept because it costs
// nothing and keeps this verb's failure path local -- a throw from
// `deps.extractList` is reported as this verb failing, at this verb's
// `startedAt`, whatever the dispatcher does. (Until 2026-09-11 the dispatcher
// returned this promise unawaited, and the catch was load-bearing.) A field
// that resolved to a sensitive control is one such throw, and it carries its
// own ACTION_REJECTED record.

import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../types";
import type { ContentActionDependencies } from "./types";

type Outcome = Awaited<ReturnType<ContentActionDependencies["extractList"]>>;

export async function extractListAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): Promise<BrowserActionResult> {
  const request = action.extractList;
  if (!request) return deps.failure(action, new Error("web.dom.extract_list needs extractList parameters."), startedAt);
  try {
    const outcome = await deps.extractList(request, { timeoutMs: action.timeoutMs });
    const minItems = minimumItems(request.minItems);
    const expected = `at least ${count(minItems, "record")}, each carrying ${Object.keys(request.fields).join(", ")}`;
    const evidence = { extracted: outcome.records, snapshot: deps.captureSnapshot() };
    if (outcome.timedOut) {
      return deps.timedOut(action, startedAt, `Timed out extracting the list after ${count(outcome.pagesRead, "page")}.`, {
        status: "failed",
        expected,
        actual: `${readSummary(outcome)}; the time ran out before the list ended`
      }, evidence);
    }
    return deps.success(action, startedAt, "List extracted.", validationFor(outcome, minItems, expected), evidence);
  } catch (error) {
    return deps.failure(action, error, startedAt);
  }
}

/** The request's minimum, or 1 when it names none: a list that matched nothing is not a success unless the author said so. */
function minimumItems(requested: number | undefined): number {
  return typeof requested === "number" && Number.isFinite(requested) ? Math.max(0, Math.trunc(requested)) : 1;
}

function validationFor(outcome: Outcome, minItems: number, expected: string): BrowserActionValidation {
  const shortfalls = [
    ...(outcome.records.length < minItems ? [`fewer than the ${minItems} required`] : []),
    ...(outcome.missingFields.length > 0 ? [`missing from some records: ${outcome.missingFields.join(", ")}`] : [])
  ];
  return shortfalls.length === 0
    ? { status: "passed", expected, actual: `${readSummary(outcome)}; every declared field present` }
    : { status: "failed", expected, actual: `${readSummary(outcome)}; ${shortfalls.join("; ")}` };
}

function readSummary(outcome: Outcome): string {
  return `${count(outcome.records.length, "record")} from ${count(outcome.pagesRead, "page")}${outcome.truncated ? ", truncated" : ""}`;
}

function count(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}
