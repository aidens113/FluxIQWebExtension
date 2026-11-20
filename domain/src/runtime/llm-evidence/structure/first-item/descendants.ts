// Every element below a node of a capture's tree, in document order: what a
// descendant combinator (`./chain.ts`) and a run's items found at any depth under
// its container (`./walk.ts`) both read.

import type { WebLlmPageTree, WebLlmTreeNode } from "./tree";

/** Every element below the node, in document order. */
export function webLlmDescendants(tree: WebLlmPageTree, node: WebLlmTreeNode): WebLlmTreeNode[] {
  const found: WebLlmTreeNode[] = [];
  const walk = (parent: WebLlmTreeNode): void => {
    for (const child of tree.children(parent)) {
      found.push(child);
      walk(child);
    }
  };
  walk(node);
  return found;
}
