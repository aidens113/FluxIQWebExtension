// Downward across shadow boundaries: the open roots beneath a document or an
// element, and everything they hold. `composed-tree.ts` says why the walks
// exist, and why a closed root never appears in them.

/** A tree a lookup can run in: the document or an open shadow root. */
type Root = Document | ShadowRoot;

/**
 * How many open shadow roots one walk collects. Real pages carry a handful;
 * the bound is what keeps a page that stamps a component per row from turning
 * every capture into an unbounded crawl.
 */
const MAX_OPEN_ROOTS = 500;

/** How many elements one walk inspects for a shadow root. The snapshot's own sweep bound. */
const MAX_ROOT_SCAN = 50_000;

/**
 * `root` and every open shadow root beneath it, nested roots included, in the
 * order their hosts appear. Closed roots are absent because they cannot be
 * reached, not because they were refused.
 */
export function composedRoots(root: Root = document): Root[] {
  const roots: Root[] = [root];
  let scanned = 0;
  for (let index = 0; index < roots.length && roots.length < MAX_OPEN_ROOTS; index += 1) {
    for (const element of roots[index]!.querySelectorAll("*")) {
      if (++scanned > MAX_ROOT_SCAN) return roots;
      const shadow = element.shadowRoot;
      if (!shadow) continue;
      roots.push(shadow);
      if (roots.length >= MAX_OPEN_ROOTS) return roots;
    }
  }
  return roots;
}

/**
 * Everything beneath the element in the painted tree, lazily: what its own
 * open shadow root holds first -- that is what is drawn -- then its light
 * descendants, each descending into any open root it hosts. The caller bounds
 * how far it reads.
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

/** The open shadow roots beneath the element, its own first, nested ones included, reading at most `limit` elements. */
export function openRootsWithin(element: Element, limit = MAX_ROOT_SCAN): ShadowRoot[] {
  const roots: ShadowRoot[] = element.shadowRoot ? [element.shadowRoot] : [];
  let read = 0;
  for (const descendant of composedDescendants(element)) {
    if (++read > limit || roots.length >= MAX_OPEN_ROOTS) break;
    if (descendant.shadowRoot) roots.push(descendant.shadowRoot);
  }
  return roots;
}

/** Every element matching `selector` in each of `roots`, root after root. The selector is the caller's own constant. */
export function queryComposed(roots: readonly Root[], selector: string): Element[] {
  return roots.flatMap((root) => [...root.querySelectorAll(selector)]);
}
