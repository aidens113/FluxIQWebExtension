// The page's structure as the packet carries it: each element's `parent`, the
// handle of its nearest described ancestor (`../sanitize.ts`). The fold rules
// walk it; a packet without it (an older capture, a recorded packet) is a
// forest of single elements, and the rules that need it do not apply.

import type { WebLlmEvidenceElement } from "../elements";

export type WebLlmPageTree = {
  /** The element's ancestors the packet describes, nearest first. Empty without `parent`. */
  ancestors(element: WebLlmEvidenceElement): readonly WebLlmEvidenceElement[];
  /** Whether `ancestor` is one of `element`'s ancestors. */
  isUnder(element: WebLlmEvidenceElement, ancestor: WebLlmEvidenceElement): boolean;
};

/**
 * The tree over a packet's elements. A parent must come before its child in
 * the packet, as it does in document order, so a malformed `parent` ends the
 * walk instead of looping.
 */
export function webLlmPageTree(elements: readonly WebLlmEvidenceElement[]): WebLlmPageTree {
  const indexOf = new Map<string, number>();
  elements.forEach((element, index) => indexOf.set(element.target, index));
  const cache = new Map<string, readonly WebLlmEvidenceElement[]>();
  const ancestors = (element: WebLlmEvidenceElement): readonly WebLlmEvidenceElement[] => {
    const known = cache.get(element.target);
    if (known !== undefined) return known;
    const own = indexOf.get(element.target);
    const parentIndex = element.parent === undefined ? undefined : indexOf.get(element.parent);
    const parent = own !== undefined && parentIndex !== undefined && parentIndex < own ? elements[parentIndex] : undefined;
    const chain = parent === undefined ? [] : [parent, ...ancestors(parent)];
    cache.set(element.target, chain);
    return chain;
  };
  return {
    ancestors,
    isUnder: (element, ancestor) => ancestors(element).includes(ancestor)
  };
}
