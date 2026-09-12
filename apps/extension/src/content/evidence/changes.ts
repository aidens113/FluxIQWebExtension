// Which elements changed, and which were just interacted with.
//
// Both were audited as partial for the same reason: they existed only while
// recording. Change was a `dom.mutation` event with four counts and no
// identity, emitted by an observer the recorder attaches and detaches; recency
// was an ordering inside the snapshot and never a field anyone downstream could
// read. Neither told a running action what moved between one snapshot and the
// next, which is the question every post-condition and every retry asks.
//
// So change is decided here, by diffing this snapshot's descriptors against the
// previous one from the same frame. The fingerprint is taken from the
// descriptor rather than from the element: the descriptor is what a consumer
// compares, so anything invisible to it is not a change anyone can observe, and
// keeping the rule off the DOM makes it testable without one. Position comes
// from `documentBounds`, which does not move when the page is scrolled -- with
// viewport bounds every element on the page would change on every scroll.
//
// The first snapshot of a frame marks nothing: there is nothing to have changed
// from, and reporting every element as new would be noise on every page load.

import type { DomElementDescriptor } from "../types";

/** One element of the snapshot with the descriptor built for it. */
export type SnapshotElementEntry = { element: Element; descriptor: DomElementDescriptor };

/** Attribute values a reader would call a state change rather than a re-render. */
const STATE_ATTRIBUTES = ["disabled", "aria-disabled", "aria-expanded", "aria-pressed", "aria-selected", "aria-current", "aria-busy", "aria-invalid"] as const;

/**
 * Well below the descriptor's own 500-character text bound: a fingerprint for
 * every element on the page is held until the next capture, and a long document
 * should not cost a megabyte to remember.
 */
const MAX_FINGERPRINT_TEXT = 120;

/** A unit separator, which page text does not contain, so two fields cannot run together into a third value. */
const FINGERPRINT_SEPARATOR = String.fromCharCode(31);

/** The previous snapshot of this frame, as key -> fingerprint. Absent until the first capture completes. */
let previous: Map<string, string> | undefined;

/**
 * Sets `changed` and `recentlyInteracted` on the descriptors, and reports how
 * many of each, for the snapshot's element totals.
 */
export function markElementActivity(
  entries: readonly SnapshotElementEntry[],
  recent: ReadonlySet<Element>
): { changed: number; recentlyInteracted: number } {
  const current = new Map<string, string>();
  // A key that repeats within one snapshot cannot be diffed: whichever
  // occurrence wins the key, every other one would read as changed on every
  // capture forever. Collected first, so both passes see the whole picture.
  const ambiguous = new Set<string>();
  for (const { descriptor } of entries) {
    const key = elementKey(descriptor);
    if (current.has(key)) ambiguous.add(key);
    else current.set(key, elementFingerprint(descriptor));
  }

  let changed = 0;
  let interacted = 0;
  for (const { element, descriptor } of entries) {
    const key = elementKey(descriptor);
    if (previous !== undefined && !ambiguous.has(key) && previous.get(key) !== current.get(key)) {
      descriptor.changed = true;
      changed += 1;
    }
    if (recent.has(element)) {
      descriptor.recentlyInteracted = true;
      interacted += 1;
    }
  }

  previous = current;
  return { changed, recentlyInteracted: interacted };
}

/** Forgets the previous snapshot, so the next capture marks nothing. Exists for tests. */
export function forgetElementActivity(): void {
  previous = undefined;
}

/** The identity a descriptor is diffed under: its xpath, which survives text and class changes. */
function elementKey(descriptor: DomElementDescriptor): string {
  return descriptor.xpath ?? descriptor.selector;
}

function elementFingerprint(descriptor: DomElementDescriptor): string {
  return [
    (descriptor.text ?? "").slice(0, MAX_FINGERPRINT_TEXT),
    descriptor.hasValue === undefined ? "" : String(descriptor.hasValue),
    descriptor.selectedValue ?? "",
    (descriptor.classNames ?? []).join(" "),
    stateAttributes(descriptor),
    positionOf(descriptor)
  ].join(FINGERPRINT_SEPARATOR);
}

/**
 * Presence, not just value: `disabled` is a boolean attribute whose value is
 * the empty string, so a fingerprint that read only values could not tell a
 * disabled control from an enabled one.
 */
function stateAttributes(descriptor: DomElementDescriptor): string {
  const attributes = descriptor.attributes;
  if (!attributes) return "";
  return STATE_ATTRIBUTES
    .map((name) => {
      const value = attributes[name];
      return value === undefined ? "" : `${name}=${value}`;
    })
    .join(",");
}

/** Rounded to whole pixels: sub-pixel layout noise is not a change anyone can see. */
function positionOf(descriptor: DomElementDescriptor): string {
  const bounds = descriptor.documentBounds;
  if (!bounds) return "";
  return `${Math.round(bounds.x)},${Math.round(bounds.y)},${Math.round(bounds.width)},${Math.round(bounds.height)}`;
}
