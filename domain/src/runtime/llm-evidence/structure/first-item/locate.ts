// Where each detected column is in the page view: the handle of its element in
// the first item, in list order, that has the column.
//
// On a site styled by atomic classes every column's label is a class path that
// means nothing -- `div.x0531l50 > div.x1a4yqcp` -- and a model shown seven of
// them mapped `mutual` to the Confirm button's column (live run 38,
// `run-muqilf9s-c3211328`, C2). The page view already prints each element's
// words beside its handle, so the handle alone says which column reads
// "1 mutual friend". No value and no selector is added (D3).
//
// A column only some items have was given no handle when the first item lacked
// it: after Amara's request was confirmed, her card alone read "Request
// accepted" beside a Message link, and the model, shown those two columns
// without a handle, filtered on the Delete column and asked for the same
// detection three more times (round 1002-M, `run-murwcaj0-40e56557`, R2). So
// the items are walked in order and the column is placed in the first one that
// has any element for it; a column every item has is placed in the first item,
// as before.
//
// The detection's own capture is the page its selectors were written against,
// so the items and each field's element in them are found there (`./tree.ts`,
// `./chain.ts`): the container by its exact selector, its children the item
// selector names, and inside the first of them that has the column the one
// element the field's selector names. The handle given is the one the model was shown for
// that element: the element's selector looked up in the last packet shown,
// which carries the Flow's stable numbering (`../../stable-handles.ts`). A
// detection capture's own numbering is positional and was never shown.
//
// Anything that cannot be told is left out, never guessed: a container that is
// not exactly one listed element, no item, a field that names no element in
// any item or several in the first item that has it, a selector form the walk
// does not read, a page the model was not shown, an element the shown packet
// does not hold. A column with no handle is
// shown as before, by its label.

import type { WebAutomationExtractionProposal, WebAutomationExtractionProposalFieldSpec } from "../../../../extraction";
import type { WebLlmEvidenceElement } from "../../elements";
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
  const items = listItems(tree, proposal);
  if (items.length === 0) return found;
  const shownHandle = shownHandles(shown, frameId);
  for (const field of proposal.fields) {
    const node = columnElement(tree, items, field.spec);
    const handle = node === undefined ? undefined : shownHandle(node);
    if (handle !== undefined) found.set(field.key, handle);
  }
  return found;
}

/**
 * Each field key with its element in the first item that has it, in the
 * detection's own capture: what a column's sample and readable label are read
 * from (`../field-sample.ts`). Needs no page shown, since nothing is named by a
 * handle; a column whose element cannot be told is left out.
 */
export function webLlmFirstItemElements(proposal: WebAutomationExtractionProposal, detected: WebLlmSnapshotBinding): ReadonlyMap<string, WebLlmEvidenceElement> {
  const found = new Map<string, WebLlmEvidenceElement>();
  const tree = webLlmPageTree(detected);
  const items = listItems(tree, proposal);
  if (items.length === 0) return found;
  for (const field of proposal.fields) {
    const node = columnElement(tree, items, field.spec);
    if (node !== undefined) found.set(field.key, node.element);
  }
  return found;
}

/**
 * The column's element in the first item that has it: the walk stops at the
 * first item with any element for the field, and gives that element only when
 * it is the one there. A form the walk does not read gives none.
 */
function columnElement(tree: WebLlmPageTree, items: readonly WebLlmTreeNode[], spec: WebAutomationExtractionProposalFieldSpec): WebLlmTreeNode | undefined {
  for (const item of items) {
    const nodes = fieldElements(tree, item, spec);
    if (nodes === undefined) return undefined;
    if (nodes.length > 0) return single(nodes);
  }
  return undefined;
}

/**
 * The run's items, in list order: the children of the container the item
 * selector names. The item selector is the container's then one compound, or one
 * compound alone for a test id every item shares
 * (`apps/extension/src/content/extraction/item-selector.ts`).
 */
function listItems(tree: WebLlmPageTree, proposal: WebAutomationExtractionProposal): WebLlmTreeNode[] {
  const container = tree.addressed(proposal.container);
  if (container === undefined) return [];
  const scoped = `${proposal.container} > `;
  const compound = proposal.item.startsWith(scoped) ? proposal.item.slice(scoped.length) : proposal.item;
  const test = webLlmCompoundMatcher(compound);
  return test === undefined ? [] : tree.children(container).filter(test);
}

/**
 * The elements a field reads in an item: the item itself for a field with no
 * selector, the cells under its header for a table column, and otherwise the
 * elements its selector names inside the item; `undefined` for a selector form
 * the walk does not read.
 */
function fieldElements(tree: WebLlmPageTree, item: WebLlmTreeNode, spec: WebAutomationExtractionProposalFieldSpec): readonly WebLlmTreeNode[] | undefined {
  if (spec.selector !== undefined) return webLlmSelectedWithin(tree, item, spec.selector);
  if (spec.header === undefined) return [item];
  const header = screenedPageText(spec.header);
  return tree.children(item).filter((cell) => (cell.tag === "td" || cell.tag === "th") && cell.element.cell?.header === header);
}

function single(nodes: readonly WebLlmTreeNode[]): WebLlmTreeNode | undefined {
  return nodes.length === 1 ? nodes[0] : undefined;
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
