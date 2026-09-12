// The extract-list verb: read a repeating structure into records.
//
// The records become the result's `extracted`; the post-condition is that every
// record carries every declared field. A field some record did not yield is a
// failed validation -- `output_not_observed` with the field named -- because a
// record list that quietly dropped a column looks exactly like a successful
// extraction to everything downstream.
//
// The capability is awaited inside this verb rather than returned to
// `execute.ts`, whose `try` block does not await what it returns: a promise
// returned from there settles after the block exits, so a rejection would
// escape its catch and leave the background worker with no reply at all.

import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../types";
import type { ContentActionDependencies } from "./types";

export async function extractListAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): Promise<BrowserActionResult> {
  const request = action.extractList;
  if (!request) return deps.failure(action, new Error("web.dom.extract_list needs extractList parameters."), startedAt);
  try {
    const outcome = await deps.extractList(request);
    return deps.success(action, startedAt, "List extracted.", validationFor(outcome, Object.keys(request.fields)), {
      extracted: outcome.records,
      snapshot: deps.captureSnapshot()
    });
  } catch (error) {
    return deps.failure(action, error, startedAt);
  }
}

type Outcome = Awaited<ReturnType<ContentActionDependencies["extractList"]>>;

function validationFor(outcome: Outcome, fieldNames: readonly string[]): BrowserActionValidation {
  const expected = `every record carries ${fieldNames.join(", ")}`;
  const read = `${count(outcome.records.length, "record")} from ${count(outcome.pagesRead, "page")}${outcome.truncated ? ", truncated" : ""}`;
  return outcome.missingFields.length === 0
    ? { status: "passed", expected, actual: `${read}; every declared field present` }
    : { status: "failed", expected, actual: `${read}; missing from some records: ${outcome.missingFields.join(", ")}` };
}

function count(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}
