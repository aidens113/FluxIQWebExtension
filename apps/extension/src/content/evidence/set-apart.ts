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
// **The run** is the element's siblings with its tag that share a class with
// it -- the chips of one picker, the tabs of one bar -- less any whose cursor
// refuses a press: a sold-out option is drawn apart too, and says so with its
// cursor (`./press-cursor.ts`). **Set apart** is being the one member of the
// run that carries a class at most half of the run carries. Two members drawn
// apart -- a consent banner's ghost "Manage choices" and primary "Accept all"
// -- mark neither, and nor does a run whose every member has a class of its
// own, `item-1`, `item-2`: a difference shared tells nothing apart. A fact
// about drawing, not a meaning: the reader is told the option is drawn apart,
// not that it is chosen.

/** Whether the element is the one member of its run of like siblings carrying a class at most half of the run carries. */
export function setApartFromLikeSiblings(element: Element): boolean {
  if (element.classList.length === 0 || refusesPress(element)) return false;
  const run = likeSiblings(element).filter((member) => member === element || !refusesPress(member));
  if (run.length < 2) return false;
  const counts = new Map<string, number>();
  for (const member of run) {
    for (const name of new Set(member.classList)) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const few = (name: string): boolean => (counts.get(name) ?? 0) * 2 <= run.length;
  const apart = run.filter((member) => [...member.classList].some(few));
  return apart.length === 1 && apart[0] === element;
}

/** The element's cursor says it refuses a press. Unknown where nothing computes styles, as in a unit test's hand-built page. */
function refusesPress(element: Element): boolean {
  return typeof getComputedStyle === "function" && getComputedStyle(element).cursor === "not-allowed";
}

/** The element and its siblings with its tag that share at least one of its classes. */
function likeSiblings(element: Element): Element[] {
  const parent = element.parentElement ?? (element.getRootNode() as Node & { children?: HTMLCollection });
  const siblings = parent.children === undefined ? [element] : [...parent.children];
  return siblings.filter((sibling) => sibling === element || (sibling.tagName === element.tagName && [...sibling.classList].some((name) => element.classList.contains(name))));
}
