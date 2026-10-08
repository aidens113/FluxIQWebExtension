// Whether a page drew one of a run of like options differently from the rest
// (t229).
//
// A shop marks the chosen size or colour with a class: a darker border, a
// tick. Nothing else says which one is chosen -- no `aria-pressed`, no
// `aria-checked`, no `selected` -- and on the crossborder marketplace the class
// name is a build hash that says nothing either. What a person sees is that
// one chip is drawn unlike the chips beside it, and that much the markup does
// say: it carries a class few of its like siblings carry.
//
// The run and the members drawn apart in it are read by `./like-options.ts`,
// which the check verb shares (t364): the element's siblings with its tag that
// share a class with it, less any whose cursor refuses a press. **Set apart**
// is being the one member of the
// run that carries a class at most half of the run carries. Two members drawn
// apart -- a consent banner's ghost "Manage choices" and primary "Accept all"
// -- mark neither, and nor does a run whose every member has a class of its
// own, `item-1`, `item-2`: a difference shared tells nothing apart. A fact
// about drawing, not a meaning: the reader is told the option is drawn apart,
// not that it is chosen.

import { likeOptions } from "./like-options";

/** Whether the element is the one member of its run of like siblings carrying a class at most half of the run carries. */
export function setApartFromLikeSiblings(element: Element): boolean {
  const options = likeOptions(element);
  return options !== undefined && options.apart.length === 1 && options.apart[0] === element;
}
