import type { FieldSource } from "../infer-fields";

/** Drop a narrower ancestor-class path only when a shared path reads the same elements. */
export function pruneEquivalentFieldPaths(sources: readonly FieldSource[], peers: readonly Element[]): FieldSource[] {
  const resolved = sources.map((source) => peers.map((peer) => elementAt(peer, source.selector)));
  return sources.filter((source, index) => !sources.some((other, otherIndex) => {
    if (index === otherIndex || !sameReading(source, other) || !broaderAncestorPath(source.selector, other.selector)) return false;
    const narrow = resolved[index]!;
    const broad = resolved[otherIndex]!;
    let overlap = false;
    let extra = false;
    for (let peer = 0; peer < peers.length; peer += 1) {
      if (narrow[peer] !== undefined) {
        if (narrow[peer] !== broad[peer]) return false;
        overlap = true;
      } else if (broad[peer] !== undefined) extra = true;
    }
    return overlap && extra;
  }));
}

function sameReading(left: FieldSource, right: FieldSource): boolean {
  return left.kind === right.kind && left.attribute === right.attribute && left.header === right.header
    && left.lines === right.lines && Boolean(left.lineOf) === Boolean(right.lineOf)
    && left.accessibleName === right.accessibleName && left.sensitive === right.sensitive;
}

/** Paths may differ only by extra ancestor classes; the leaf itself must be identical. */
function broaderAncestorPath(narrow: string | undefined, broad: string | undefined): boolean {
  if (!narrow?.startsWith(":scope > ") || !broad?.startsWith(":scope > ")) return false;
  const from = narrow.split(" > ");
  const to = broad.split(" > ");
  if (from.length !== to.length || from.at(-1) !== to.at(-1)) return false;
  let changed = false;
  for (let index = 1; index < from.length - 1; index += 1) {
    if (from[index] === to[index]) continue;
    const specific = classStep(from[index]!);
    const shared = classStep(to[index]!);
    if (!specific || !shared || specific.tag !== shared.tag || shared.classes.length >= specific.classes.length
      || !shared.classes.every((name) => specific.classes.includes(name))) return false;
    changed = true;
  }
  return changed;
}

function classStep(step: string): { tag: string; classes: string[] } | undefined {
  const match = /^([a-z][a-z0-9-]*)((?:\.[A-Za-z_-][\w-]*)+)$/u.exec(step);
  return match ? { tag: match[1]!, classes: match[2]!.slice(1).split(".") } : undefined;
}

function elementAt(peer: Element, selector: string | undefined): Element | undefined {
  if (selector === undefined) return undefined;
  const found = peer.querySelectorAll(selector);
  return found.length === 1 ? found[0] : undefined;
}
