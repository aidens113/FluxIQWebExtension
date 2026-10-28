// Which handles a dialog view keeps that its newer capture no longer shows
// (t781): those whose control the newer capture shows at the same place under
// a handle the view did not hold -- a toggle in its other state -- and no
// others.
//
// Measured on photo-social (t775 photo-dialog-step): exploration's capture of
// the post's dialog showed the Like as `t593`; a trial captured the dialog with
// the post liked, the Unlike under `t724` and no `t593`, and that capture
// replaced the view. After the undo, the post's own page printed `t593` again,
// the builder resubmitted the like step naming it, the dialog view no longer
// held it, and the step took the own page's control into the dialog: refused
// `web.target.ambiguous` among the dialog's Likes. A live model writes that
// Flow.
//
// So a handle the newer capture dropped is kept where, in this order:
//
// 1. a handle new to the view stands at its exact place (`./control-places.ts`):
//    the same address, tag, role and context. Every handle the view held there
//    is kept, each a state of that one control;
// 2. else, where its loose place -- positions taken out -- holds exactly one
//    dropped control (the handles of one exact place) and exactly one handle
//    new to the view that tier 1 did not match.
//
// Never otherwise. A control with nothing new at its place -- a section that
// closed, a row removed -- is gone, as before. A handle the view already held
// is no other state of a dropped control: rows that shift up into a removed
// row's address keep their own handles, and keep nothing.

/** The handles of `earlier` that `newer` does not show and keeps by place (header); `placesOf` gives a control's two places. */
export function webLlmKeptByPlace<T>(earlier: ReadonlyMap<string, T>, newer: ReadonlyMap<string, T>, placesOf: (target: T) => { exact: string; loose: string }): Set<string> {
  const kept = new Set<string>();
  const fresh = [...newer].filter(([handle]) => !earlier.has(handle)).map(([, target]) => placesOf(target));
  if (fresh.length === 0) return kept;
  const freshExact = new Set(fresh.map((places) => places.exact));
  // Tier 1, and the dropped controls left after it, by exact place.
  const matched = new Set<string>();
  const left = new Map<string, { loose: string; handles: string[] }>();
  for (const [handle, target] of earlier) {
    if (newer.has(handle)) continue;
    const places = placesOf(target);
    if (freshExact.has(places.exact)) {
      kept.add(handle);
      matched.add(places.exact);
      continue;
    }
    const control = left.get(places.exact) ?? { loose: places.loose, handles: [] };
    control.handles.push(handle);
    left.set(places.exact, control);
  }
  // Tier 2, only where one dropped control and one new handle leave nothing to choose.
  const count = (keys: Iterable<string>): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  };
  const freshLoose = count(fresh.filter((places) => !matched.has(places.exact)).map((places) => places.loose));
  const leftLoose = count([...left.values()].map((control) => control.loose));
  for (const control of left.values()) {
    if (freshLoose.get(control.loose) === 1 && leftLoose.get(control.loose) === 1) for (const handle of control.handles) kept.add(handle);
  }
  return kept;
}
