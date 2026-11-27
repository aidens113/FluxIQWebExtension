// The acts that witness where a host absolute target came from (t1071, F3).
//
// A draft keeps the exact parameters an act resolved, and a control a page shows
// alike on two pages -- a header's cart link -- matches two retained sources when
// the draft is assembled. `./absolute.ts` then asks for a witness: an act whose
// view names the target exactly. Until t1071 the only witness was the first act
// on each handle (`../target-packets.ts` `acted`), which is also what a candidate
// step restores its identity from. Every attempt of a task runs under one Flow,
// and the handle store numbers one control alike across them, so the first act
// was attempt 1's, as the control read then. Live run `run-mwyfc9uf-215bbd84`:
// attempt 2 pressed the cart link as it read "🛒 2 $5.25", the store still held
// attempt 1's press of "🛒 1 $3.97" and nothing of attempt 2's, and the repaired
// draft was refused `web.handle.ambiguous` at that step (0062), so no repair was
// ever saved.
//
// So each act is kept here as a witness of its own source -- the location,
// document, frame and layer it was made in (`./source.ts`) -- whatever came
// before it. Two copies, when they differ: the control as the act's capture
// showed it, and as the page the act resolved it on held it, the identity its
// views agree on (`../element-identity.ts`), which is what the act ran with and
// so what its draft step carries. The first act from one source stands: an
// undo's later state in the same document never replaces it (t743). A witness
// only ever establishes lineage for a target whose identity it names exactly;
// `./absolute.ts` still refuses when witnesses or matches disagree.

/** What a witness needs of a retained target: its source and the identity it names. */
type Witnessable = { shared: boolean; element: unknown; intentSource: { key: string } };

export type WebPlanActWitnesses<T extends Witnessable> = {
  /** Keep the act on `handle` made from `captured`'s source, and `held`, the target the act resolved there, where it is the same control. */
  witness(handle: string, captured: T, held: T | undefined, sameAddress: (left: T, right: T) => boolean): void;
  values(): IterableIterator<T>;
};

/** One Flow's act witnesses, the oldest let go past `bound`. */
export function createWebPlanActWitnesses<T extends Witnessable>(bound: number): WebPlanActWitnesses<T> {
  const kept = new Map<string, T>();
  return {
    witness(handle, captured, held, sameAddress) {
      const each = [captured];
      if (held !== undefined && !held.shared && sameAddress(held, captured) && held.intentSource.key === captured.intentSource.key) each.push(held);
      for (const target of each) {
        const key = `${handle}\u0000${target.intentSource.key}\u0000${JSON.stringify(target.element)}`;
        if (!kept.has(key)) kept.set(key, { ...target, element: structuredClone(target.element) });
      }
      for (const oldest of kept.keys()) if (kept.size > bound) kept.delete(oldest); else break;
    },
    values: () => kept.values()
  };
}
