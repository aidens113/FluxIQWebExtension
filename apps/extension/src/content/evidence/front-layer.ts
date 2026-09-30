// Which elements sit in a layer the page paints over itself, marked on each
// such element's descriptor as `frontLayer: true` (`dom-snapshot.ts`).
//
// The front layer is what paints over the page: a consent banner, a cookie
// bar, a sticky action bar, a chat launcher. The page behind a consent banner
// cannot be clicked until the banner is answered, so a reader that is choosing
// what to press has to know which controls are on it. On the everything store
// this is the difference between a model that dismisses the banner covering
// ten of its controls and one that presses a control underneath it and is
// refused.
//
// Until t200 the snapshot ranked a front layer's controls to the head of a
// capped element list (`evidence/controls.ts`, `isFrontLayer`). The list is no
// longer ranked or cut, and ordering is gone with the ranking; what the rule
// knew is kept as a fact on every element it holds for. It is asked of every
// rendered element now, not only of controls: whether a sticky header's links
// matter is the reader's question, and the flag only says where they are
// painted.
//
// **The rule** is the one the ranking used. An element is in a front layer when
// it or one of its nearest ancestors -- `MAX_FRONT_LAYER_DEPTH` elements in
// all, itself included -- has a computed `position` of `fixed` or `sticky`.
// The walk stops at `body` and `html`. A control inside a shadow root is asked
// through its hosts as well, because the fixed layer is usually the custom
// element itself -- `rf-consent` is `position: fixed` and its buttons are not
// -- and the walk up from inside a root stops at the root.
//
// Computed style rather than the inline attribute, because the position that
// matters is the one the page's stylesheet applied.

import { shadowHostsOf } from "../shadow-dom";

/**
 * How many elements, the element itself first, are asked for a positioned
 * layer: it and its seven nearest ancestors. A banner is its control's parent
 * or grandparent; a deeper walk only finds the page's own scroll containers,
 * which would mark most of an app-shell page.
 */
const MAX_FRONT_LAYER_DEPTH = 8;

/**
 * A front-layer test for one capture. Each element's position is read once
 * and remembered for the rest of the capture: every element of a banner walks
 * through the same few ancestors, and the page does not change while the
 * snapshot reads it.
 */
export function frontLayerTest(): (element: Element) => boolean {
  const positioned = new Map<Element, boolean>();
  const isPositioned = (element: Element): boolean => {
    let answer = positioned.get(element);
    if (answer === undefined) {
      const position = getComputedStyle(element).position;
      answer = position === "fixed" || position === "sticky";
      positioned.set(element, answer);
    }
    return answer;
  };
  const inLayerFrom = (element: Element): boolean => {
    let current: Element | null = element;
    for (let depth = 0; current && depth < MAX_FRONT_LAYER_DEPTH; depth += 1) {
      if (current === current.ownerDocument?.body || current === current.ownerDocument?.documentElement) return false;
      if (isPositioned(current)) return true;
      current = current.parentElement;
    }
    return false;
  };
  return (element) => inLayerFrom(element) || shadowHostsOf(element).some(inLayerFrom);
}
