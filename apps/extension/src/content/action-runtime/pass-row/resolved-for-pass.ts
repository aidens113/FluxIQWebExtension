// A For Each pass's row, applied to the control a step presses on that pass.
//
// The domain writes the pass's row into every recorded element it dispatches on
// a pass, as `context.record.values` (`domain/src/output-nodes/targets/row-scope.ts`).
// Where the build saw the control inside a repeated thing, the record also
// carries its `key` or `text`, or the context its `listPosition`, and the
// values are a gate as they always were: the control is accepted only in the
// record that holds every value (`../../identity/record.ts`).
//
// Where it carries none of those, the saved identity says nothing about rows,
// and that silence is about the packet, not the page. Live run
// `run-mvd0qwhi-5f7dbf80`: a feed draws each post as a `[role=article]` inside
// `[role=feed]`, which has no list position, and the post's "Hide post" was
// saved as `{ landmark: "main" }` beside a positional selector. The row was
// dropped, so pass 1 hid the post the build had looked at rather than row 1,
// and pass 2 -- that post now a "Hidden ... Undo" bar -- met eleven identical
// "Hide post" buttons and failed `web.target.ambiguous` in every trial.
//
// So the page decides, by the one rule a recording places a control by:
//
// 1. A control the build never placed in a row is first resolved as it was
//    recorded, rows aside. An answer that sits in no repeated row -- a
//    dialog's Close, the page's search box, a toolbar -- is the same control
//    on every pass, and is acted on.
// 2. Otherwise -- and always for a control the build placed in a row -- it is
//    resolved with the row's values as the gate, so it is found in the pass's
//    own row, whatever an earlier pass did to another row, since the row is
//    found by what it holds, never by where it is.
// 3. Where that finds nothing, the control is placed by structure
//    (`row-slot.ts`): the build's control, found on the page as recorded with
//    the pass row aside, sits in a row of several like it, and the pass's row
//    is the one beside it whose copy of the same slot holds every value and
//    differs from the build's only by row data (`row-data.ts`) -- a title
//    link's own title, id and link (job save r1), a gallery tile's own counts
//    (photo newest-likes r1, `run-mvecxeci-1c2cc227`: every pass opened the
//    first tile). The gated resolution can never accept such a copy, since
//    nothing distinguishing it agrees with the recording. It is reported by
//    `placed`: the strategy that found the build's control, with no score,
//    since nothing scored the copy.
//
// A row that holds no such control fails as not found rather than pressing
// another row's. The as-recorded answer in another row is never acted on, and
// its failure is never reported: the pass's row is what the step was asked
// about.

import { sitsInRepeatedRow, type RecordIdentity } from "../../identity";
import type { DomElementContext } from "../../types";
import { placedInPassRow } from "./row-slot";

/** One resolution's answer, or the failure it would report. */
export type PassOutcome<Resolved, Failure> = { resolved: Resolved } | { failed: Failure };

/** A recorded target as far as this module reads it: where it sat. */
type Placed = { context?: DomElementContext | undefined };

/**
 * The answer for `target`, through `resolve`, with a pass's row applied by the
 * rule in the header. A target that carries no pass row is resolved once,
 * exactly as given. `placed` reports the pass row's copy of the build's
 * control, from the answer that found the build's.
 */
export function resolvedForPass<Target extends Placed, Resolved extends { element: Element }, Failure>(
  target: Target | undefined,
  resolve: (recorded: Target | undefined) => PassOutcome<Resolved, Failure>,
  placed: (built: Resolved, element: Element) => Resolved
): PassOutcome<Resolved, Failure> {
  const record = target?.context?.record;
  if (!target || !record?.values?.length) return resolve(target);
  const asBuilt = withoutPassRow(target);
  let built: PassOutcome<Resolved, Failure> | undefined;
  if (unplaced(record, target.context)) {
    built = resolve(asBuilt);
    if ("resolved" in built && !sitsInRepeatedRow(built.resolved.element)) return built;
  }
  const inRow = resolve(target);
  if ("resolved" in inRow) return inRow;
  built ??= resolve(asBuilt);
  if (!("resolved" in built)) return inRow;
  const copy = placedInPassRow(built.resolved.element, record);
  return copy ? { resolved: placed(built.resolved, copy) } : inRow;
}

/** Whether the row is the only thing that places the target: values, and no `key`, `text` or `listPosition` the build recorded. */
function unplaced(record: RecordIdentity, context: DomElementContext | undefined): boolean {
  return !record.key && !record.text && !context?.listPosition;
}

/** The target as the build recorded it: its pass row's values taken off, and its record with them when nothing else is left in it. */
function withoutPassRow<Target extends Placed>(target: Target): Target {
  const context: DomElementContext = { ...target.context };
  const record = context.record;
  if (record) {
    const built: RecordIdentity = { ...record };
    delete built.values;
    if (built.key || built.text) context.record = built;
    else delete context.record;
  }
  return { ...target, context };
}
