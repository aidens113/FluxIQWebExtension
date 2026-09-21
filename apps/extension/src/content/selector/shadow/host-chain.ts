// The shadow roots an element sits inside, written down so a replay can walk
// back into them.
//
// `unique-selector.ts` writes an element's selector within the tree the element
// is in, because that is the only tree a selector can be checked against. For
// an element inside a shadow root that selector is half an address:
// `document.querySelectorAll` reaches neither the element nor anything the
// selector says about its ancestors. Lane E measured what the half does alone:
// a chat widget's Close, recorded as `div:nth-of-type(2) > div` inside the
// widget's shadow root, matched seven unrelated elements of the light document
// at replay, and lane D's consent "Accept all" matched none.
//
// The other half is this chain: every shadow root between the document and the
// element, outermost first, each named by its host's selector in the tree the
// host itself sits in. `scope.ts` walks it back before anything is looked up.
//
// Only open roots can appear. An event from inside a closed root is retargeted
// to its host, so the recorder never describes an element in one.

import { selectorFor } from "../unique-selector";

const DOCUMENT_FRAGMENT_NODE = 11;

/** The selectors of the shadow hosts around `element`, outermost first; `undefined` for an element in a document. */
export function shadowHostChain(element: Element): string[] | undefined {
  const hosts: string[] = [];
  for (let root = element.getRootNode(); isShadowRoot(root); root = root.host.getRootNode()) {
    hosts.unshift(selectorFor(root.host));
  }
  return hosts.length ? hosts : undefined;
}

function isShadowRoot(node: Node): node is ShadowRoot {
  return node.nodeType === DOCUMENT_FRAGMENT_NODE && "host" in node;
}
