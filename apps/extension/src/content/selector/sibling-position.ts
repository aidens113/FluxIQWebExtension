// Where an element stands among its siblings of the same type: the number an
// xpath step carries (`element-finder.ts`, `button[3]`) and a CSS step's
// `:nth-of-type(3)` (`unique-selector.ts`).
//
// Why a table. Answering it by walking the siblings costs one walk per element,
// and a snapshot describes every element of a parent: a nav of 6,000 links
// walked 6,000 siblings 6,000 times, twice (once per path), and a bare capture
// of that page took 30 seconds where it had taken 4 (t289; the walk cost
// nothing while the snapshot was capped at 2,000 elements). Inside a capture
// (`withSelectorMemo`) the first question about a parent's children indexes
// all of them in one pass, and every later one is a lookup. Outside a scope
// nothing is kept, so an action's descriptor is measured against the page as
// it is then -- one walk, as before.
//
// The two paths group siblings differently, and each keeps its own grouping:
// an xpath step counts siblings with the same `tagName` -- what XPath's name
// test matches -- and `:nth-of-type` those with the same local name and
// namespace, which is what CSS counts. They part only where an HTML and a
// foreign element share a name.

import { activeSelectorMemo } from "./selector-memo";

/** How siblings are grouped: by `tagName` for an xpath step, by local name and namespace for `:nth-of-type`. */
export type SiblingGrouping = "tag-name" | "local-name";

/** The element's 1-based index among its same-type siblings, and whether any other sibling shares its type. */
export type SiblingPosition = { readonly index: number; readonly shared: boolean };

/** Where `element` stands among the element children of `parent` that share its type; first and alone when it has no parent. */
export function siblingPosition(element: Element, parent: ParentNode | null, grouping: SiblingGrouping): SiblingPosition {
  if (!parent) return { index: 1, shared: false };
  const memo = activeSelectorMemo();
  if (!memo) return walk(element, parent, grouping);
  let byGrouping = memo.siblingPositions.get(parent);
  if (!byGrouping) {
    byGrouping = new Map();
    memo.siblingPositions.set(parent, byGrouping);
  }
  let table = byGrouping.get(grouping);
  if (!table) {
    table = index(parent, grouping);
    byGrouping.set(grouping, table);
  }
  // A child the table does not hold is not one of this parent's: answered as the walk answers it.
  return table.get(element) ?? walk(element, parent, grouping);
}

function typeKey(element: Element, grouping: SiblingGrouping): string {
  if (grouping === "tag-name") return element.tagName;
  return `${element.namespaceURI === null ? "\u0001" : element.namespaceURI}\u0000${element.localName}`;
}

/** Every element child's position, in one pass to count and one to record. */
function index(parent: ParentNode, grouping: SiblingGrouping): Map<Element, SiblingPosition> {
  const children = parent.children;
  const keys: string[] = [];
  const indexes: number[] = [];
  const counts = new Map<string, number>();
  for (let at = 0; at < children.length; at += 1) {
    const key = typeKey(children[at]!, grouping);
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    keys.push(key);
    indexes.push(count);
  }
  const table = new Map<Element, SiblingPosition>();
  for (let at = 0; at < children.length; at += 1) {
    table.set(children[at]!, { index: indexes[at]!, shared: (counts.get(keys[at]!) ?? 0) > 1 });
  }
  return table;
}

/** The same answer by one walk over the parent's element children. */
function walk(element: Element, parent: ParentNode, grouping: SiblingGrouping): SiblingPosition {
  const key = typeKey(element, grouping);
  const children = parent.children;
  let index = 0;
  let found = false;
  let shared = false;
  for (let at = 0; at < children.length; at += 1) {
    const sibling = children[at]!;
    if (sibling === element) {
      found = true;
      index += 1;
      continue;
    }
    if (typeKey(sibling, grouping) !== key) continue;
    shared = true;
    if (!found) index += 1;
    else break;
  }
  // Not among them at all: first, as a lone element is. A parent never answers so for its own child.
  return found ? { index, shared } : { index: 1, shared: false };
}
