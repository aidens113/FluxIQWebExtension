// A For Each pass's row, applied to a control the build never placed in a row.
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
// 1. The control is resolved as it was recorded, rows aside. An answer that
//    sits in no repeated row -- a dialog's Close, the page's search box, a
//    toolbar -- is the same control on every pass, and is acted on.
// 2. Otherwise the control is a row's, or nothing answered, or it tied: it is
//    resolved again with the row's values as the gate, so it is found in the
//    pass's own row -- whatever an earlier pass did to another row, since the
//    row is found by what it holds, never by where it is -- and a row that holds
//    no such control fails as not found rather than pressing another row's.
// 3. Where that finds nothing and the first answer is itself a tile -- one of
//    a run of same-shaped siblings, each the control and each naming itself
//    by its own content -- the pass's tile is the one member of that run that
//    holds the row (`run-member.ts`). A tile names nothing another tile
//    shares, so the gated resolution can never corroborate it; the run and
//    the row's values place it instead (photo newest-likes r1,
//    `run-mvecxeci-1c2cc227`: every pass opened the first tile). It is
//    reported as the first answer's resolution with the pass's tile in place
//    of the build's: the strategy that found the run, applied in the row.
//
// The first resolution's answer in another row is never acted on, and its
// failure is never reported: the pass's row is what the step was asked about.

import { sitsInRepeatedRow } from "../../identity";
import type { DomElementContext } from "../../types";
import { runMemberForRow } from "./run-member";

/** One resolution's answer, or the failure it would report. */
export type PassOutcome<Resolved, Failure> = { resolved: Resolved } | { failed: Failure };

/** A recorded target as far as this module reads it: where it sat. */
type Placed = { context?: DomElementContext | undefined };

/**
 * The answer for `target`, through `resolve`, with a pass's row applied by the
 * rule in the header. A target that carries no pass row, or whose row the build
 * placed, is resolved once, exactly as given.
 */
export function resolvedForPass<Target extends Placed, Resolved extends { element: Element }, Failure>(
  target: Target | undefined,
  resolve: (recorded: Target | undefined) => PassOutcome<Resolved, Failure>
): PassOutcome<Resolved, Failure> {
  const rowsAside = withoutUnplacedRow(target);
  if (!rowsAside) return resolve(target);
  const anywhere = resolve(rowsAside);
  if ("resolved" in anywhere && !sitsInRepeatedRow(anywhere.resolved.element)) return anywhere;
  const inRow = resolve(target);
  if ("resolved" in inRow || !("resolved" in anywhere)) return inRow;
  const member = runMemberForRow(anywhere.resolved.element, target?.context?.record);
  return member ? { resolved: { ...anywhere.resolved, element: member } } : inRow;
}

/**
 * The target with its pass row taken off, when the row is the only thing that
 * places it: values and no `key`, `text` or `listPosition` the build recorded.
 * `undefined` when there is no pass row, or the build placed the control itself.
 */
function withoutUnplacedRow<Target extends Placed>(target: Target | undefined): Target | undefined {
  const context = target?.context;
  const record = context?.record;
  if (!target || !context || !record?.values?.length) return undefined;
  if (record.key || record.text || context.listPosition) return undefined;
  const placed: DomElementContext = { ...context };
  delete placed.record;
  return { ...target, context: placed };
}
