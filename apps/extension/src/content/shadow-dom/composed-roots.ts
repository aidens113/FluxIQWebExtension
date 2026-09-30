// Downward across shadow boundaries: the open roots beneath a document or an
// element, and everything they hold. `composed-tree.ts` says why the walks
// exist, and why a closed root never appears in them.

/** A tree a lookup can run in: the document or an open shadow root. */
type Root = Document | ShadowRoot;

/**
 * `root` and every open shadow root beneath it, nested roots included, in the
 * order their hosts appear. Closed roots are absent because they cannot be
 * reached, not because they were refused.
 *
 * Unbounded (t200): a walk that stopped at 500 roots or 50,000 elements left
 * the rest of a page -- often the consent wall a vendor mounts last -- out of
 * every capture, and nothing downstream could tell it had happened.
 */
export function composedRoots(root: Root = document): Root[] {
  const roots: Root[] = [root];
  for (let index = 0; index < roots.length; index += 1) {
    for (const element of roots[index]!.querySelectorAll("*")) {
      const shadow = element.shadowRoot;
      if (shadow) roots.push(shadow);
    }
  }
  return roots;
}

/**
 * Everything beneath the element in the painted tree, lazily: what its own
 * open shadow root holds first -- that is what is drawn -- then its light
 * descendants, each descending into any open root it hosts. A caller that
 * needs a bound stops reading.
 */
export function* composedDescendants(element: Element): Generator<Element> {
  const pending: Array<Element | ShadowRoot> = [element];
  if (element.shadowRoot) pending.unshift(element.shadowRoot);
  while (pending.length) {
    for (const child of pending.shift()!.querySelectorAll("*")) {
      yield child;
      if (child.shadowRoot) pending.push(child.shadowRoot);
    }
  }
}

/** The open shadow roots beneath the element, its own first, nested ones included. */
export function openRootsWithin(element: Element): ShadowRoot[] {
  const roots: ShadowRoot[] = element.shadowRoot ? [element.shadowRoot] : [];
  for (const descendant of composedDescendants(element)) {
    if (descendant.shadowRoot) roots.push(descendant.shadowRoot);
  }
  return roots;
}

/** Every element matching `selector` in each of `roots`, root after root. The selector is the caller's own constant. */
export function queryComposed(roots: readonly Root[], selector: string): Element[] {
  return roots.flatMap((root) => [...root.querySelectorAll(selector)]);
}
