// Telling a shadow root from a document or an element, without `instanceof`:
// the extension's unit tests run in Node, where there is no `ShadowRoot` class
// for a hand-built tree to be an instance of.

const DOCUMENT_FRAGMENT_NODE = 11;

/** Whether the node is a shadow root: a document fragment with a host. */
export function isShadowRoot(node: Node | null | undefined): node is ShadowRoot {
  return Boolean(node) && node!.nodeType === DOCUMENT_FRAGMENT_NODE && "host" in node!;
}
