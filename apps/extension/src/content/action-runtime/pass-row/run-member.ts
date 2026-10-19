// The tile a loop pass is on, in a run of tiles that are themselves the
// controls (photo newest-likes r1, `run-mvecxeci-1c2cc227`).
//
// A gallery tile's name is its own counts and its link its own post, so a
// recorded tile names nothing a tile in another row shares: resolved with the
// row's values as the gate, every tile but the pass's is refused, and the
// pass's own is refused too, since nothing distinguishing it agrees with the
// recording (`../../identity/corroboration.ts`). What does place it is the run:
// the recorded tile, wherever it is now, is one of a run of same-shaped tiles
// (`../../identity/own-run.ts`), and the pass's row is the one tile of that run
// that holds every value the pass carries. That tile is the control, at its
// own index in the run.
//
// Exactly one, or none: two tiles holding the same row say nothing of which is
// meant, and a row whose tile is not drawn is not found, never another tile.

import { agreesWithRecordedRecord, ownRun, type RecordIdentity } from "../../identity";

/**
 * The member of `answer`'s run that holds every value `record` carries, when
 * `answer` is one of a run of same-shaped tiles and exactly one member does;
 * otherwise `undefined`.
 */
export function runMemberForRow(answer: Element, record: RecordIdentity | undefined): Element | undefined {
  if (!record?.values?.length) return undefined;
  const run = ownRun(answer);
  if (!run) return undefined;
  const holding = run.filter((member) => agreesWithRecordedRecord(record, member));
  return holding.length === 1 ? holding[0] : undefined;
}
