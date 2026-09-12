import type { WebAutomationElementStateInput } from "../types";

// What an element is called in state. Two questions live here and they are not
// the same one: which authored attribute identifies the element across
// sessions (`stableElementId`), and which key it is filed under inside the
// `elements.*` namespace (`elementStateId` / `assignElementStateIds`).
//
// The state key must be unique within one snapshot, and an authored identifier
// is not: a table of rows, a list of cards, a repeated form group all ship the
// same `data-testid` on every instance. Uniqueness is therefore a property of
// the whole selection, not of one element, which is why the collection-level
// `elementStateIdAssigner` exists and is the only thing that may decide a
// final key.

const MAX_STATE_ID_LENGTH = 120;

// Text worth treating as an identifier: present, and more than a stray
// character of whitespace-trimmed content.
export function meaningfulText(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length >= 2;
}

// An authored attribute, or `undefined` when it is absent or says nothing.
export function stableAttribute(element: WebAutomationElementStateInput, name: string): string | undefined {
  const value = element.attributes?.[name];
  return meaningfulText(value) ? value : undefined;
}

// The identifier a person wrote that should survive a re-render, reported on
// the element payload and used to judge how much to trust a match. `name` is
// included because a form control's name is authored and stable even though it
// is shared by every radio in a group.
export function stableElementId(element: WebAutomationElementStateInput): string | undefined {
  return stableAttribute(element, "data-testid") ??
    stableAttribute(element, "data-test") ??
    stableAttribute(element, "data-cy") ??
    stableAttribute(element, "id") ??
    stableAttribute(element, "name");
}

// The element's state key before disambiguation. Authored test ids and `id`
// win because they survive a re-render; below them the selector is folded in,
// because a `name` alone is shared by a whole radio group and a selector alone
// is the only thing left. Not unique on its own: see `assignElementStateIds`.
export function elementStateId(element: WebAutomationElementStateInput): string {
  const stable = stableElementPathId(element);
  if (stable) return sanitizeStateId(stable);
  const name = stableAttribute(element, "name");
  if (name) return sanitizeStateId(`${name}.${element.selector}`);
  return sanitizeStateId(element.selector);
}

// Hands out final, unique state keys across one snapshot's elements. Call the
// returned function once per element, in document order, and use nothing else
// as an element's state key.
//
// Elements sharing a base key are distinguished by a positional suffix rather
// than collapsed into one entry: `row.action`, `row.action.2`, `row.action.3`.
// Collapsing is what this replaces, and it lost every repeated control on the
// page -- every row's delete button but the first, every card's "Add to cart" --
// leaving the state with one entry where the page had twenty.
//
// The first occurrence keeps the bare key, so a page without repetition, and
// the first instance of a repeated group, keep the key they have always had
// and Core's transition comparison sees no path churn. The ordinal is only as
// stable as the order it is fed, which is why document order is the contract:
// a rank that moves with an element's score would rename it on every snapshot.
//
// `reservedIds` are keys already spoken for inside `elements.*` -- the snapshot
// summary writes `elements.count` -- so an element whose identifier sanitizes
// to one of them is suffixed instead of overwriting it.
export function elementStateIdAssigner(reservedIds: Iterable<string> = []): (element: WebAutomationElementStateInput) => string {
  const taken = new Set<string>(reservedIds);
  const occurrences = new Map<string, number>();
  return (element) => {
    const base = elementStateId(element);
    let occurrence = (occurrences.get(base) ?? 0) + 1;
    let candidate = occurrence === 1 ? base : `${base}.${occurrence}`;
    // A suffixed key can collide with a base key spelled the same way -- an
    // element whose own id sanitizes to "row.action.2" -- so keep counting
    // until the key is free rather than overwriting a sibling.
    while (taken.has(candidate)) {
      occurrence += 1;
      candidate = `${base}.${occurrence}`;
    }
    occurrences.set(base, occurrence);
    taken.add(candidate);
    return candidate;
  };
}

// Only identifiers that outlive a re-render may become the whole state key; a
// `name` may not, because it is shared across a group by design.
function stableElementPathId(element: WebAutomationElementStateInput): string | undefined {
  return stableAttribute(element, "data-testid") ??
    stableAttribute(element, "data-test") ??
    stableAttribute(element, "data-cy") ??
    stableAttribute(element, "id");
}

function sanitizeStateId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, MAX_STATE_ID_LENGTH) || "element";
}
