// Walking the page as it is painted, across open shadow roots: the one place
// the content script's enumeration, containment and ordering cross a shadow
// boundary. `composed-tree.ts` says why, and what happens to a closed root;
// it walks up and across, `composed-roots.ts` walks down, and
// `query-in-order.ts` answers a selector across every open root in the order
// the page is read. The point lookup that descends through roots is
// `../selector`'s `deepElementFromPoint`.

export { composedDescendants, composedRoots, openRootsWithin, queryComposed } from "./composed-roots";
export { queryComposedInOrder } from "./query-in-order";
export { composedClosest, composedContains, composedDocumentOrder, composedParent, shadowHostsOf } from "./composed-tree";
