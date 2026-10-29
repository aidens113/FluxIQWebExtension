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
import { webLlmPageTree, type WebLlmPageTree, type WebLlmTreeNode } from "./tree";

/** The capture's tree, the run's items in it in list order, and how a field's elements are found in one of them. */
export type WebLlmCaptureWalk = {
  tree: WebLlmPageTree;
  items: readonly WebLlmTreeNode[];
  /**
   * The elements a field reads in an item: the item itself for a field with no
   * selector, the cells under its header for a table column, and otherwise the
   * elements its selector names inside the item; `undefined` for a selector
   * form the walk does not read.
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
      if (spec.selector !== undefined) return webLlmSelectedWithin(tree, item, spec.selector);
      if (spec.header === undefined) return [item];
      const header = screenedPageText(spec.header);
      return tree.children(item).filter((cell) => (cell.tag === "td" || cell.tag === "th") && cell.element.cell?.header === header);
    }
  };
}

function listItems(tree: WebLlmPageTree, proposal: WebAutomationExtractionProposal): WebLlmTreeNode[] {
  const container = tree.addressed(proposal.container);
  if (container === undefined) return [];
  const scoped = `${proposal.container} > `;
  const compound = proposal.item.startsWith(scoped) ? proposal.item.slice(scoped.length) : proposal.item;
  const test = webLlmCompoundMatcher(compound);
  return test === undefined ? [] : tree.children(container).filter(test);
}
