// A detection's items and each field's elements in them, in the detection's
// own capture: the walk every per-item reading of a detected list starts from.
//
// The first item's handles and samples (`./locate.ts`) and each item's marks
// and identity (`../list-items/`) all follow the same selectors down the same
// tree, so they all read it here (moved out of `./locate.ts` in t800).

import type { WebAutomationExtractionProposal, WebAutomationExtractionProposalFieldSpec } from "../../../../extraction";
import type { WebLlmSnapshotBinding } from "../../sanitize";
import { screenedPageText } from "../../withheld";
import { webLlmSelectedWithin } from "./chain";
import { webLlmCompoundMatcher } from "./compound";
import { webLlmDescendants } from "./descendants";
import { webLlmDefinitionElements } from "./definition";
import { webLlmPageTree, type WebLlmPageTree, type WebLlmTreeNode } from "./tree";

/** The capture's tree, the run's items in it in list order, and how a field's elements are found in one of them. */
export type WebLlmCaptureWalk = {
  tree: WebLlmPageTree;
  items: readonly WebLlmTreeNode[];
  /**
   * The elements a field reads in an item: the item itself for a field with no
   * selector or `:scope`, the cells under its header for a table column, and
   * otherwise the elements its selector names inside the item -- or, for a
   * field with a `group`, inside the item's nearest ancestor that group names
   * (none where it sits in none); `undefined` for a selector form the walk
   * does not read.
   */
  elementsOf(item: WebLlmTreeNode, spec: WebAutomationExtractionProposalFieldSpec): readonly WebLlmTreeNode[] | undefined;
};

/**
 * The walk of the proposal over its capture. The items are the children of the
 * container the item selector names; the item selector is the container's then
 * one compound, or one compound alone for a test id every item shares
 * (`apps/extension/src/content/extraction/item-selector.ts`). No item is found
 * where the container is not exactly one listed element or the compound is not
 * one the walk reads.
 */
export function webLlmCaptureWalk(proposal: WebAutomationExtractionProposal, detected: WebLlmSnapshotBinding): WebLlmCaptureWalk {
  const tree = webLlmPageTree(detected);
  return {
    tree,
    items: listItems(tree, proposal),
    elementsOf(item, spec) {
      if (spec.group === undefined) return elementsIn(tree, item, spec);
      const group = groupOf(tree, item, spec.group, proposal.container);
      // A group the item sits in none of names nothing; a group selector this does not read is not told.
      if (group === undefined) return webLlmCompoundMatcher(groupCompound(spec.group, proposal.container)) === undefined ? undefined : [];
      return elementsIn(tree, group, spec);
    }
  };
}

/** The elements the field's own selector, definition or header names inside one element. */
function elementsIn(tree: WebLlmPageTree, base: WebLlmTreeNode, spec: WebAutomationExtractionProposalFieldSpec): readonly WebLlmTreeNode[] | undefined {
  if (spec.definition !== undefined) return webLlmDefinitionElements(tree, base, spec);
  if (spec.selector === ":scope") return [base];
  if (spec.selector !== undefined) return webLlmSelectedWithin(tree, base, spec.selector);
  if (spec.header === undefined) return [base];
  const header = screenedPageText(spec.header);
  return tree.children(base).filter((cell) => (cell.tag === "td" || cell.tag === "th") && cell.element.cell?.header === header);
}

/** The compound a selector written under the container names: what follows `container > `, else the whole selector. */
function groupCompound(selector: string, container: string): string {
  const scoped = `${container} > `;
  return selector.startsWith(scoped) ? selector.slice(scoped.length) : selector;
}

/** The item's nearest ancestor the group selector names, as `closest` finds it from the item's parent. */
function groupOf(tree: WebLlmPageTree, item: WebLlmTreeNode, group: string, container: string): WebLlmTreeNode | undefined {
  const test = webLlmCompoundMatcher(groupCompound(group, container));
  if (test === undefined) return undefined;
  const scoped = group.startsWith(`${container} > `);
  const boundary = scoped ? tree.addressed(container) : undefined;
  if (scoped && boundary === undefined) return undefined;
  for (let node = tree.parent(item); node !== undefined; node = tree.parent(node)) {
    if (node === boundary) return undefined;
    if (test(node) && (!scoped || tree.parent(node) === boundary)) return node;
  }
  return undefined;
}

/**
 * The run's items: the container's children where the selector is the
 * container's then one compound (`container > li.card`), and every element below
 * the container the compound names otherwise -- a test id, or a descendant
 * selector (`container div.slot`), which is how a grid's cells, held in groups
 * of their own, are named (`apps/extension/src/content/extraction/cell-run/`).
 */
function listItems(tree: WebLlmPageTree, proposal: WebAutomationExtractionProposal): WebLlmTreeNode[] {
  const container = tree.addressed(proposal.container);
  if (container === undefined) return [];
  const child = `${proposal.container} > `;
  const below = `${proposal.container} `;
  if (proposal.item.startsWith(child)) {
    const test = webLlmCompoundMatcher(proposal.item.slice(child.length));
    return test === undefined ? [] : tree.children(container).filter(test);
  }
  const test = webLlmCompoundMatcher(proposal.item.startsWith(below) ? proposal.item.slice(below.length) : proposal.item);
  if (test === undefined) return [];
  return webLlmDescendants(tree, container).filter(test);
}
