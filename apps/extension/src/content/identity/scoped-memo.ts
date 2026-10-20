// Answers one capture keeps, for the identity rules a snapshot asks of every
// element it describes (t733).
//
// A capture runs inside `withSelectorMemo` (`../selector/selector-memo.ts`):
// one synchronous pass that only reads the page. While it runs, an answer
// about an element stays true, so a rule asked the same question again -- the
// row walk of a control, by its record and again by its subject; a row's title,
// by each control inside it -- may hand back what it found the first time.
// Outside a scope nothing is kept: an action's descriptor is measured against
// the page as it is then, after whatever a click changed. Each table lives as
// long as its scope's memo and no longer, as `../evidence/lead-statements.ts`
// keeps its own.

import { activeSelectorMemo, type SelectorMemo } from "../selector";

/**
 * A table of answers by key, kept for the rest of the running capture scope.
 * The returned function answers `compute()` -- once per key per scope inside
 * one, every time outside one. `undefined` is an answer and is kept like any
 * other.
 */
export function scopedMemo<K extends object, V>(): (key: K, compute: () => V) => V {
  const byScope = new WeakMap<SelectorMemo, Map<K, V>>();
  return (key, compute) => {
    const scope = activeSelectorMemo();
    if (!scope) return compute();
    let known = byScope.get(scope);
    if (!known) {
      known = new Map();
      byScope.set(scope, known);
    }
    if (known.has(key)) return known.get(key) as V;
    const answer = compute();
    known.set(key, answer);
    return answer;
  };
}
