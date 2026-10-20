// A control's alike controls, as one capture knows them (t733).
//
// The row walk (`sole-ancestors.ts`) asks, of every node it passes, whether it
// is a control alike to the one it climbs from: the same kind and the same
// accessible name. Asked afresh by every control a snapshot describes, that
// named the same links over and over -- a page of 6,000 uniquely named links
// spent 372 s naming them, where a snapshot had taken 4. Inside a capture scope
// the question is answered once per root instead:
//
// - each root the climb can see -- the document, or the shadow root a control
//   sits in (`getRootNode()`) -- is enumerated once, through `children` and
//   never into a shadow root, which is exactly what a walk that moves by
//   `parentElement` and `children` can reach;
// - each element's kind is read once, and the elements of one kind are named
//   once, the first time a control of that kind asks, and grouped by name;
// - each element's count of descendant elements is kept, which is what lets a
//   climb that can find no alike say how far it would have got without walking.
//
// Outside a scope there is no index (`undefined`), and the climb walks the
// live page as it always has.

import { activeSelectorMemo } from "../../selector";
import { accessibleNameFor } from "../accessible-name";
import { scopedMemo } from "../scoped-memo";
import { controlKind } from "./control-kind";

/** What a capture knows about a control's alike controls. */
export type CapturedAlike = {
  /** The control's accessible name; `undefined` when it has none, and then nothing is alike to it. */
  readonly name: string | undefined;
  /** Every element in the control's root of its kind and name, the control included. */
  readonly members: ReadonlySet<Element>;
  /** The element's count of descendant elements in the light tree of its root, or `undefined` for one outside it. */
  readonly descendants: (element: Element) => number | undefined;
};

/** One root's index: its elements by kind, each kind's elements by name once asked, and every element's descendant count. */
type RootIndex = {
  readonly byKind: Map<string, Element[]>;
  readonly byName: Map<string, Map<string, Set<Element>>>;
  readonly descendants: Map<Element, number>;
};

const NO_MEMBERS: ReadonlySet<Element> = new Set();

const rootIndexes = scopedMemo<Node, RootIndex>();
const names = scopedMemo<Element, string | undefined>();

/**
 * The control's alike controls by the index of its root, or `undefined` outside
 * a capture scope, where nothing may be kept, or for a host whose elements
 * cannot say what root they sit in.
 */
export function capturedAlike(control: Element): CapturedAlike | undefined {
  if (!activeSelectorMemo() || typeof control.getRootNode !== "function") return undefined;
  const root = control.getRootNode();
  const index = rootIndexes(root, () => indexRoot(root));
  const descendants = (element: Element): number | undefined => index.descendants.get(element);
  const name = nameOf(control);
  if (!name) return { name: undefined, members: NO_MEMBERS, descendants };
  return { name, members: kindByName(index, controlKind(control)).get(name) ?? new Set([control]), descendants };
}

/** The element's accessible name, read once per scope. */
function nameOf(element: Element): string | undefined {
  return names(element, () => accessibleNameFor(element));
}

/** The kind's elements grouped by name, named the first time the kind is asked for. */
function kindByName(index: RootIndex, kind: string): Map<string, Set<Element>> {
  const known = index.byName.get(kind);
  if (known) return known;
  const grouped = new Map<string, Set<Element>>();
  for (const element of index.byKind.get(kind) ?? []) {
    const name = nameOf(element);
    if (!name) continue;
    const group = grouped.get(name);
    if (group) group.add(element);
    else grouped.set(name, new Set([element]));
  }
  index.byName.set(kind, grouped);
  return grouped;
}

/**
 * Every element below the root, by kind, with its descendant count; the root
 * itself is counted too when it is an element -- a detached subtree's top --
 * since a climb can reach it as an ancestor.
 */
function indexRoot(root: Node): RootIndex {
  const byKind = new Map<string, Element[]>();
  const descendants = new Map<Element, number>();
  const order: Element[] = [];
  if (isElement(root)) descendants.set(root, 0);
  const pending: Element[] = [...childElements(root)];
  for (let element = pending.pop(); element; element = pending.pop()) {
    order.push(element);
    descendants.set(element, 0);
    const kind = controlKind(element);
    const ofKind = byKind.get(kind);
    if (ofKind) ofKind.push(element);
    else byKind.set(kind, [element]);
    for (const child of childElements(element)) pending.push(child);
  }
  // A child is always enumerated after its parent, so read backwards every count is whole before it is added to its parent's.
  for (let position = order.length - 1; position >= 0; position -= 1) {
    const element = order[position] as Element;
    const parent = element.parentElement;
    const parentCount = parent ? descendants.get(parent) : undefined;
    if (parent && parentCount !== undefined) descendants.set(parent, parentCount + (descendants.get(element) ?? 0) + 1);
  }
  return { byKind, byName: new Map(), descendants };
}

/** A node's element children, as a walk by `children` sees them; none for a host node that lists none. */
function childElements(node: Node): readonly Element[] {
  const children = (node as Partial<ParentNode>).children;
  return children ? Array.from(children) : [];
}

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}
