// The run of like options an element belongs to, and which of its members the
// page drew apart from the rest (t229, t364).
//
// Two readers ask it. The snapshot marks the one member drawn apart
// (`./set-apart.ts`), which the page view prints as `marked`; and the check
// verb reads a picker's chosen option by the same rule
// (`../action-runtime/checkable-state/chosen-state.ts`), so the option the view shows as
// chosen is the one `web.dom.check` finds chosen, and the two cannot disagree.
//
// **The run** is the element's siblings with its tag that share a class with
// it -- the chips of one picker, the tabs of one bar -- less any whose cursor
// refuses a press: a sold-out option is drawn apart too, and says so with its
// cursor (`./press-cursor.ts`). **Drawn apart** is carrying a class at most
// half of the run carries. An element with no class, one whose own cursor
// refuses a press, or one with no like sibling a person could press belongs to
// no run.

/** A run of like options and the members of it drawn apart from the rest. */
export type LikeOptions = { run: readonly Element[]; apart: readonly Element[] };

/** The run the element belongs to and its members drawn apart, or `undefined` when it belongs to none. */
export function likeOptions(element: Element): LikeOptions | undefined {
  if (element.classList.length === 0 || refusesPress(element)) return undefined;
  const run = likeSiblings(element).filter((member) => member === element || !refusesPress(member));
  if (run.length < 2) return undefined;
  const counts = new Map<string, number>();
  for (const member of run) {
    for (const name of new Set(member.classList)) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const few = (name: string): boolean => (counts.get(name) ?? 0) * 2 <= run.length;
  return { run, apart: run.filter((member) => [...member.classList].some(few)) };
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
