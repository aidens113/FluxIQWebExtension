// How a newer whole view of a page merges with what the target store held of it
// (moved out of `../target-packets.ts` in t903, where it grew past its bound).
//
// Each handle the newer view shows at the address the earlier view showed it
// keeps only what both views agree on (`across`, which `../target-packets.ts`
// owns); a handle the newer view does not show has left the page.
//
// **Except a hidden one (t903).** A capture lists what is rendered, and only a
// search's capture lists what is not (each such element marked `hidden`). So a
// view that lists no hidden element cannot say a hidden one has gone. On
// `run-mwbkuxqt-c57f42cb` the line the task asked for sat in a closed account
// menu and only a search printed its handle; the look a node run takes before
// it acts then dropped it, and a read or a detection named that handle in vain.
// So such a view keeps every handle an earlier view showed as hidden that it
// does not show itself, at no address it shows. The page still says whether the
// element is there when a step names it.

/**
 * `targets`, a newer view of a page, merged with `before`, the earlier one (header).
 * A new map, so the views' own stay as they were shown.
 */
export function webPlanAcrossViews<Target extends { hidden?: true }>(
  before: ReadonlyMap<string, Target>,
  targets: ReadonlyMap<string, Target>,
  across: (earlier: Target | undefined, target: Target) => Target,
  addressOf: (target: Target) => string
): Map<string, Target> {
  const kept = new Map<string, Target>();
  for (const [handle, target] of targets) kept.set(handle, across(before.get(handle), target));
  if ([...targets.values()].some((target) => target.hidden === true)) return kept;
  const addresses = new Set([...targets.values()].map(addressOf));
  for (const [handle, target] of before) {
    if (target.hidden === true && !kept.has(handle) && !addresses.has(addressOf(target))) kept.set(handle, target);
  }
  return kept;
}
