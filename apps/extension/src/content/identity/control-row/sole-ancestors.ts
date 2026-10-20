// The climb every row rule of `control-row/` is built on: the ancestors of a
// control that hold it and no other control alike to it.
//
// The climb walks, at each level, the new part of the parent's subtree --
// everything but the child it came up through -- for a second alike control,
// against one node budget shared by the whole climb. On a page where nothing
// is alike to the control, every walk is fruitless and spends that whole
// budget; asked by every control a snapshot describes, that was 93% of a
// 372-second capture of 6,000 uniquely named links (t733, profiled in t730).
//
// Inside a capture scope the answer is the same and costs almost nothing
// (`captured-alike.ts`). A control nothing reachable is alike to -- no alike in
// its root but its own ancestors and descendants, which no walk visits -- is
// not walked: through level `i` a walk would have scanned every descendant of
// the parent at that level except the control's own subtree and the `i`
// ancestors already climbed, `descendants(p_i) - descendants(control) - (i +
// 1)` nodes, and it runs out of budget exactly when that passes the budget,
// since the budget is tested before each visit. A control with alike controls
// that a walk could reach is walked as before, and a node is alike by
// membership in its group rather than by being named again. Either way the
// climb is kept for the rest of the scope, which `controlRow`, `recordSubject`
// and `repeatedRowOf` all ask.

import { accessibleNameFor } from "../accessible-name";
import { scopedMemo } from "../scoped-memo";
import { capturedAlike, type CapturedAlike } from "./captured-alike";
import { controlKind } from "./control-kind";
import { ROW_BOUNDS } from "./row-bounds";

/** The ancestors that hold a control and no other alike to it, innermost first, and the alike control that ended the climb. */
export type SoleAncestors = {
  ancestors: Element[];
  /** The alike control found in the next ancestor up; absent when the climb ended at a bound, the document, or a nameless control. */
  twin: Element | undefined;
};

/** Alike controls a reachability check is worth asking about one by one; past this, the walk itself decides. */
const MAX_REACHABILITY_CHECKS = 8;

const climbs = scopedMemo<Element, SoleAncestors>();

/**
 * Every ancestor of `control` that holds it and no other control alike to it,
 * innermost first. The climb stops at the first ancestor that holds a second
 * one -- which is returned as `twin` -- at the depth bound, at the top of the
 * tree, or when the shared scan budget runs out, in which case the ancestors
 * already proven are kept and `twin` is absent.
 */
export function soleAncestors(control: Element): SoleAncestors {
  const found = climbs(control, () => climb(control));
  return { ancestors: [...found.ancestors], twin: found.twin };
}

function climb(control: Element): SoleAncestors {
  const captured = capturedAlike(control);
  if (!captured) {
    const alike = alikeTo(control);
    return alike ? walk(control, alike) : { ancestors: [], twin: undefined };
  }
  if (captured.name === undefined) return { ancestors: [], twin: undefined };
  const alike = (element: Element): boolean => element !== control && captured.members.has(element);
  if (anyReachable(control, captured.members)) return walk(control, alike);
  return derivedClimb(control, captured) ?? walk(control, alike);
}

/** A test for a control alike to this one -- same role, same accessible name -- or `undefined` for one with no name to tell it by. */
function alikeTo(control: Element): ((element: Element) => boolean) | undefined {
  const name = accessibleNameFor(control);
  if (!name) return undefined;
  const kind = controlKind(control);
  return (element) => element !== control && controlKind(element) === kind && accessibleNameFor(element) === name;
}

/** The climb, walking each level's new nodes for an alike control. */
function walk(control: Element, alike: (element: Element) => boolean): SoleAncestors {
  const ancestors: Element[] = [];
  const scan = { budget: ROW_BOUNDS.scan };
  let current = control;
  for (let depth = 0; depth < ROW_BOUNDS.depth; depth += 1) {
    const parent = current.parentElement;
    if (!parent) return { ancestors, twin: undefined };
    const another = anotherAlike(parent, current, alike, scan);
    if (another === OUT_OF_BUDGET) return { ancestors, twin: undefined };
    if (another) return { ancestors, twin: another };
    ancestors.push(parent);
    current = parent;
  }
  return { ancestors, twin: undefined };
}

/**
 * The climb's outcome where no walk could find an alike control, from the
 * descendant counts alone (header); `undefined` -- walk instead -- if an
 * ancestor is missing from the index, which a root's own ancestors never are.
 */
function derivedClimb(control: Element, captured: CapturedAlike): SoleAncestors | undefined {
  const own = captured.descendants(control);
  if (own === undefined) return undefined;
  const ancestors: Element[] = [];
  let current = control;
  for (let depth = 0; depth < ROW_BOUNDS.depth; depth += 1) {
    const parent = current.parentElement;
    if (!parent) return { ancestors, twin: undefined };
    const below = captured.descendants(parent);
    if (below === undefined) return undefined;
    if (below - own - (depth + 1) > ROW_BOUNDS.scan) return { ancestors, twin: undefined };
    ancestors.push(parent);
    current = parent;
  }
  return { ancestors, twin: undefined };
}

/**
 * Whether a walk from the control could meet any alike control: one that is
 * neither the control's ancestor nor inside it, since a walk visits neither.
 * A large group is assumed reachable and left to the walk to decide.
 */
function anyReachable(control: Element, members: ReadonlySet<Element>): boolean {
  if (members.size - (members.has(control) ? 1 : 0) > MAX_REACHABILITY_CHECKS) return true;
  for (const member of members) {
    if (member !== control && !onControlPath(control, member)) return true;
  }
  return false;
}

/** Whether `member` is an ancestor of the control or sits inside it. */
function onControlPath(control: Element, member: Element): boolean {
  for (let current = control.parentElement; current; current = current.parentElement) {
    if (current === member) return true;
  }
  for (let current = member.parentElement; current; current = current.parentElement) {
    if (current === control) return true;
  }
  return false;
}

/** The scan ran out before it could say. */
const OUT_OF_BUDGET = Symbol("out-of-budget");

/**
 * An alike control in `parent` outside `path`, the child the climb came up
 * through; `undefined` when there is none, `OUT_OF_BUDGET` when the shared node
 * budget ran out first.
 */
function anotherAlike(parent: Element, path: Element, alike: (element: Element) => boolean, scan: { budget: number }): Element | undefined | typeof OUT_OF_BUDGET {
  const pending: Element[] = [...parent.children].filter((child) => child !== path);
  for (let element = pending.pop(); element; element = pending.pop()) {
    if (scan.budget <= 0) return OUT_OF_BUDGET;
    scan.budget -= 1;
    if (alike(element)) return element;
    for (const child of element.children) pending.push(child);
  }
  return undefined;
}
