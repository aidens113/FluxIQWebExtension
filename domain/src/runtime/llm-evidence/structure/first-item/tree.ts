// A capture's elements as the tree a detection's selectors are walked down.
//
// A snapshot lists every element the page renders (`apps/extension/src/content/
// rendered-elements.ts`), each with its tag, every attribute, the nearest
// listed ancestor as `parent`, and -- kept in the binding, never published --
// the selector that addresses it. That is enough to follow the detection's
// container, item and field selectors to elements without a document.
//
// An element's place among its siblings of one tag is read off its own
// selector, which the page wrote as `<parent's selector> > tag:nth-of-type(n)`,
// or with no position when it is the only one of its tag
// (`apps/extension/src/content/selector/unique-selector.ts`). Counting the
// listed siblings instead would miscount past one the page does not render.
// An element addressed by an anchor of its own (`[data-testid="x"]`) says no
// position, and a step that asks for one does not match it.
//
// Only the captured document's own elements are in the tree: a child frame
// merged into a top-frame capture is another document.

import { attributeRecord } from "../../attributes";
import type { WebLlmEvidenceElement } from "../../elements";
import type { WebLlmSnapshotBinding } from "../../sanitize";
import type { WebLlmCompoundSubject } from "./compound";

/** One element of the tree: what a compound is tested against, and what it is in the capture. */
export type WebLlmTreeNode = WebLlmCompoundSubject & {
  element: WebLlmEvidenceElement;
  /** The selector the capture addresses it by. Never published. */
  selector: string;
};

export type WebLlmPageTree = {
  /** The one element the capture addresses by exactly this selector, or `undefined` when none or several are. */
  addressed(selector: string): WebLlmTreeNode | undefined;
  /** The element's listed children, in document order. */
  children(node: WebLlmTreeNode): readonly WebLlmTreeNode[];
};

/** The tree of a capture's own document. */
export function webLlmPageTree(binding: WebLlmSnapshotBinding): WebLlmPageTree {
  const byHandle = new Map<string, WebLlmEvidenceElement>();
  for (const element of binding.evidence.elements) {
    if ((element.frameId ?? 0) === 0) byHandle.set(element.target, element);
  }
  const childrenOf = new Map<string, WebLlmTreeNode[]>();
  const bySelector = new Map<string, WebLlmTreeNode[]>();
  for (const element of byHandle.values()) {
    const selector = binding.selectors.get(element.target);
    if (selector === undefined) continue;
    const parentSelector = element.parent === undefined ? undefined : binding.selectors.get(element.parent);
    const node: WebLlmTreeNode = {
      tag: element.tag,
      attributes: attributeRecord(element.attributes ?? []),
      typeIndex: typeIndexOf(selector, parentSelector),
      element,
      selector
    };
    listed(bySelector, selector).push(node);
    if (element.parent !== undefined && byHandle.has(element.parent)) listed(childrenOf, element.parent).push(node);
  }
  return {
    addressed(selector) {
      const found = bySelector.get(selector) ?? [];
      return found.length === 1 ? found[0] : undefined;
    },
    children(node) {
      return childrenOf.get(node.element.target) ?? [];
    }
  };
}

/** The list kept under `key`, made empty the first time it is asked for. */
function listed(lists: Map<string, WebLlmTreeNode[]>, key: string): WebLlmTreeNode[] {
  const known = lists.get(key);
  if (known !== undefined) return known;
  const made: WebLlmTreeNode[] = [];
  lists.set(key, made);
  return made;
}

/**
 * The element's place among its parent's children of its tag, from its own
 * selector's last step: the step's `:nth-of-type(n)`, or 1 when the step names
 * no position. `undefined` when the selector is not its parent's and one step.
 */
function typeIndexOf(selector: string, parentSelector: string | undefined): number | undefined {
  if (parentSelector === undefined) return undefined;
  const prefix = `${parentSelector} > `;
  if (!selector.startsWith(prefix)) return undefined;
  const step = selector.slice(prefix.length);
  if (step === "" || /[\s>]/u.test(step)) return undefined;
  const position = /:nth-of-type\(([1-9][0-9]*)\)$/u.exec(step);
  return position ? Number(position[1]) : 1;
}
