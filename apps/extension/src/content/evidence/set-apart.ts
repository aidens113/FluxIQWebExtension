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
//
// **The classes that set it apart** are state, not identity (t436): the
// crossborder chip saved while chosen carried the class only the chosen chip
// has, so on a later visit its fingerprint described whichever chip was then
// chosen. `setApartClasses` names them, for the one member set apart only, so
// a saved fingerprint leaves them out (`../describe-element.ts`) as the
// domain's builder leaves out an attribute that holds a control's state.

import { likeOptions } from "./like-options";

/** Whether the element is the one member of its run of like siblings carrying a class at most half of the run carries. */
export function setApartFromLikeSiblings(element: Element): boolean {
  const options = likeOptions(element);
  return options !== undefined && options.apart.length === 1 && options.apart[0] === element;
}

/**
 * The element's classes that set it apart from its like siblings, when it is
 * the one member set apart; none otherwise. Asked of every described element,
 * so the run is read only when a like sibling lacks one of the element's
 * classes: without one, no class of the element is scarce in any run, and the
 * cursors `likeOptions` reads are not asked.
 */
export function setApartClasses(element: Element): string[] {
  if (!likeSiblingLacksAClass(element)) return [];
  const options = likeOptions(element);
  if (options === undefined || options.apart.length !== 1 || options.apart[0] !== element) return [];
  return [...element.classList].filter((name) => options.scarce.has(name));
}

/** Some sibling with the element's tag shares one of its classes and lacks another. */
function likeSiblingLacksAClass(element: Element): boolean {
  const names = [...element.classList];
  if (names.length < 2) return false;
  const parent = element.parentElement ?? (element.getRootNode() as Node & { children?: HTMLCollection });
  for (const sibling of parent.children ?? []) {
    if (sibling === element || sibling.tagName !== element.tagName) continue;
    const theirs = (name: string): boolean => sibling.classList.contains(name);
    if (names.some(theirs) && !names.every(theirs)) return true;
  }
  return false;
}
