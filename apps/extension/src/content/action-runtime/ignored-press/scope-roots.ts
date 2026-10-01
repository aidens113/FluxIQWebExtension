// The shadow roots inside a press's scope (`press-scope.ts`), each of which
// must be observed beside the scope itself.
//
// A subtree observation of an element never sees into a shadow root beneath
// it: a mutation inside a root is delivered only to observers of that root.
// And a widget that keeps its control in its own root -- a location picker, a
// consent wall, a date picker -- answers a press entirely inside that root:
// its panel's `hidden` flips, its chip's `aria-expanded` changes, and nothing
// in the light tree moves. Watching the scope alone took that answer for no
// answer, and the control was pressed again, which shut the panel the first
// press had opened (local-classifieds' radius chip, t194-w24 GAP 1).
//
// So the roots are:
//
// - every root the scope's walk crossed on its way up from the pressed
//   control, found through each element's `parentNode`, which reaches a closed
//   root too -- the control was handed to us from inside it;
// - every open root beneath the scope, nested ones included, because the
//   control's answer can land in a component beside it, or in the control's
//   own root when the control is a host. A closed root beneath the scope
//   cannot be reached, and is not watched.

import { composedParent, openRootsWithin } from "../../shadow-dom";

/** Every shadow root inside `scope` that a change answering a press on `pressed` could land in, each once. */
export function scopeRoots(pressed: Element, scope: Element): Node[] {
  const roots: Node[] = [];
  const add = (root: Node): void => {
    if (!roots.includes(root)) roots.push(root);
  };
  for (let current: Element | null = pressed; current && current !== scope; ) {
    const parent = composedParent(current);
    // A composed parent that is not the parent element is the host of the
    // root `current` sits at the top of: that root was crossed.
    if (parent && !current.parentElement && current.parentNode) add(current.parentNode);
    current = parent;
  }
  for (const root of openRootsWithin(scope)) add(root);
  return roots;
}
