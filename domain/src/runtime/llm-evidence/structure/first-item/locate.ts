// Where each detected column is in the page view: the handle of its element in
// the list's first item.
//
// On a site styled by atomic classes every column's label is a class path that
// means nothing -- `div.x0531l50 > div.x1a4yqcp` -- and a model shown seven of
// them mapped `mutual` to the Confirm button's column (live run 38,
// `run-muqilf9s-c3211328`, C2). The page view already prints each element's
// words beside its handle, so the handle alone says which column reads
// "1 mutual friend". No value and no selector is added (D3).
//
// The detection's own capture is the page its selectors were written against,
// so the first item and each field's element in it are found there
// (`./tree.ts`, `./chain.ts`): the container by its exact selector, the first
// of its children the item selector names, and inside it the one element the
// field's selector names. The handle given is the one the model was shown for
// that element: the element's selector looked up in the last packet shown,
// which carries the Flow's stable numbering (`../../stable-handles.ts`). A
// detection capture's own numbering is positional and was never shown.
//
// Anything that cannot be told is left out, never guessed: a container that is
// not exactly one listed element, an item or a field that names no element or
// several, a selector form the walk does not read, a page the model was not
// shown, an element the shown packet does not hold. A column with no handle is
// shown as before, by its label.

import type { WebAutomationExtractionProposal, WebAutomationExtractionProposalFieldSpec } from "../../../../extraction";
import type { WebLlmSnapshotBinding } from "../../sanitize";
import { screenedPageText } from "../../withheld";
import { webLlmSelectedWithin } from "./chain";
import { webLlmCompoundMatcher } from "./compound";
import { webLlmPageTree, type WebLlmPageTree, type WebLlmTreeNode } from "./tree";

/** The captures a detection's columns are placed with. */
export type WebLlmFirstItemPages = {
  /** The capture the detection answered with: the page its selectors describe. */
  detected: WebLlmSnapshotBinding;
  /** The last packet the model was shown, whose handles it reads; `undefined` when it was shown none. */
  shown: WebLlmSnapshotBinding | undefined;
  /** The child frame the detection ran in; `undefined` for the top frame. */
  frameId: number | undefined;
};

/** Each field key the model may be told the element of, with that element's handle in the page it was shown. */
export function webLlmFirstItemHandles(proposal: WebAutomationExtractionProposal, pages: WebLlmFirstItemPages): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  const { detected, shown, frameId } = pages;
  if (shown === undefined) return found;
  // A top-frame detection names the page the model read, or nothing in it. A
  // frame's capture has the frame's own address, held to it in `../detect.ts`.
  if (frameId === undefined && shown.evidence.location !== detected.evidence.location) return found;
  const tree = webLlmPageTree(detected);
  const item = firstItem(tree, proposal);
  if (item === undefined) return found;
  const shownHandle = shownHandles(shown, frameId);
  for (const field of proposal.fields) {
    const node = fieldElement(tree, item, field.spec);
    const handle = node === undefined ? undefined : shownHandle(node);
    if (handle !== undefined) found.set(field.key, handle);
  }
  return found;
}

/**
 * The run's first item: the first child of the container the item selector
 * names. The item selector is the container's then one compound, or one
 * compound alone for a test id every item shares
 * (`apps/extension/src/content/extraction/item-selector.ts`).
 */
function firstItem(tree: WebLlmPageTree, proposal: WebAutomationExtractionProposal): WebLlmTreeNode | undefined {
  const container = tree.addressed(proposal.container);
  if (container === undefined) return undefined;
  const scoped = `${proposal.container} > `;
  const compound = proposal.item.startsWith(scoped) ? proposal.item.slice(scoped.length) : proposal.item;
  const test = webLlmCompoundMatcher(compound);
  return test === undefined ? undefined : tree.children(container).find(test);
}

/**
 * The one element a field reads in the item: the item itself for a field with
 * no selector, the cell under its header for a table column, and otherwise the
 * one element its selector names inside the item.
 */
function fieldElement(tree: WebLlmPageTree, item: WebLlmTreeNode, spec: WebAutomationExtractionProposalFieldSpec): WebLlmTreeNode | undefined {
  if (spec.selector !== undefined) return single(webLlmSelectedWithin(tree, item, spec.selector));
  if (spec.header === undefined) return item;
  const header = screenedPageText(spec.header);
  return single(tree.children(item).filter((cell) => (cell.tag === "td" || cell.tag === "th") && cell.element.cell?.header === header));
}

function single(nodes: readonly WebLlmTreeNode[] | undefined): WebLlmTreeNode | undefined {
  return nodes !== undefined && nodes.length === 1 ? nodes[0] : undefined;
}

/** The handle the shown packet gives an element of the detected capture: the one element there with its selector, frame and tag. */
function shownHandles(shown: WebLlmSnapshotBinding, frameId: number | undefined): (node: WebLlmTreeNode) => string | undefined {
  const tagOf = new Map(shown.evidence.elements.filter((element) => (element.frameId ?? 0) === (frameId ?? 0)).map((element) => [element.target, element.tag]));
  const bySelector = new Map<string, string[]>();
  for (const [handle, selector] of shown.selectors) {
    if (!tagOf.has(handle)) continue;
    bySelector.set(selector, [...(bySelector.get(selector) ?? []), handle]);
  }
  return (node) => {
    const handles = (bySelector.get(node.selector) ?? []).filter((handle) => tagOf.get(handle) === node.tag);
    return handles.length === 1 ? handles[0] : undefined;
  };
}
