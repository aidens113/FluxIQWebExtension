// One selector asked of the whole painted page, answered in the order a person
// reads it.
//
// `queryComposed` answers root after root -- everything the document matches,
// then everything the first open root matches -- which is the right shape for
// a lookup but not for a list a reader is handed: a consent wall's buttons
// would follow the page's footer. The page-evidence lists (`evidence/`) are
// handed to a reader, so they ask here, and a match inside a shadow root sits
// where its host sits (`composedDocumentOrder`).

import { composedRoots, queryComposed } from "./composed-roots";
import { composedDocumentOrder } from "./composed-tree";

/** Every element matching `selector` in the document and every open shadow root beneath it, in composed document order. */
export function queryComposedInOrder(selector: string, root: Document = document): Element[] {
  const roots = composedRoots(root);
  const found = queryComposed(roots, selector);
  // Within one tree `querySelectorAll` is already in document order; only a
  // page with open roots has matches to put back in place.
  return roots.length > 1 ? found.sort(composedDocumentOrder) : found;
}
