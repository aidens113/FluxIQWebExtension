// Telling apart the elements of one packet that would otherwise look the same.
//
// The realistic sites repeat labels on purpose, because real sites do: a store
// has an "Add to cart" in every card and a "Go" beside the search box and the
// price filter, a dialog has its own "Close" over a banner with another, and a
// page is full of wrappers the capture describes as a bare `div`. The model is
// shown each of them as an element with an opaque handle, and until
// 2026-09-21 nothing else: two elements whose every published field agreed
// were two handles for one description, and the model had no way to choose
// between them but to guess. On the home page of the everything store, three
// of the first ten elements were `{ tag: "div" }` and nothing more.
//
// So an element that would otherwise read exactly like another element in the
// same packet is given what a person would use to tell them apart, and only
// that element, so a page without look-alikes costs nothing:
//
// - `dialog`, the name of the open dialog it sits in, where the look-alikes are
//   not all in the same one;
// - `within`, the words of the row, card or list item it sits in -- the
//   record's own words, less its controls' (`apps/extension/src/content/
//   identity/record.ts`) -- where those words differ between them;
// - and, for any that still read the same, `alike`: which of them this is, top
//   to bottom on the page, and how many there are in this packet.
//
// All three are closed and bounded: two short page strings already cut to the
// packet's placement bound, and a pair of counts. After them no two elements
// of a packet have the same description, which is the property the tests hold.
//
// What "the same" means is every field that says what the element is and where
// it sits. State -- a value, a selection, focus, whether it was just touched --
// is not identity: it changes as the Flow runs, and "the one that is filled" is
// not a control anybody can find again. `repeats` is a count of the page's
// alike rows, not a fact about this element, and the handle is what is being
// chosen, so neither counts either.

import type { WebLlmEvidenceElement } from "./elements";

/** What the page says about an element beyond what it is, published only where it tells two look-alikes apart. */
export type WebLlmLookAlikeCues = {
  /** The words of the row, card or list item the element sits in, already bounded. */
  within?: string | undefined;
  /** The name of the open dialog the element sits in, already bounded. */
  dialog?: string | undefined;
  /** Where the element starts on the page, for counting look-alikes top to bottom. */
  position?: { top: number; left: number } | undefined;
};

/** The cues that are published, in the order they are tried. */
const CUES = ["dialog", "within"] as const;

/**
 * Give every element of `elements` that reads like another the cues that tell
 * them apart, in place. Any cue a previous call wrote is cleared first, so it
 * can be called again after the packet loses elements to its byte budget and
 * the look-alikes left are counted as they are now.
 */
export function tellWebLlmLookAlikesApart(elements: WebLlmEvidenceElement[], cues: ReadonlyMap<string, WebLlmLookAlikeCues>): void {
  for (const element of elements) {
    delete element.dialog;
    delete element.within;
    delete element.alike;
  }
  for (const group of lookAlikeGroups(elements)) {
    for (const cue of CUES) {
      const values = group.map((element) => cues.get(element.target)?.[cue]);
      // A cue every one of them shares, or none of them has, tells nobody apart.
      if (new Set(values).size < 2) continue;
      group.forEach((element, index) => {
        const value = values[index];
        if (value !== undefined) element[cue] = value;
      });
    }
  }
  for (const group of lookAlikeGroups(elements)) {
    const ordered = [...group].sort(topToBottom(cues, elements));
    ordered.forEach((element, index) => {
      element.alike = { index: index + 1, total: ordered.length };
    });
  }
}

/** Every set of two or more elements with one description, each in packet order. */
function lookAlikeGroups(elements: readonly WebLlmEvidenceElement[]): WebLlmEvidenceElement[][] {
  const groups = new Map<string, WebLlmEvidenceElement[]>();
  for (const element of elements) {
    const key = webLlmElementDescription(element);
    const group = groups.get(key);
    if (group) group.push(element);
    else groups.set(key, [element]);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

/**
 * What the model is told an element is and where it sits, as one string two
 * elements share exactly when the model could not tell them apart.
 *
 * Written as a record of every key, each either described or deliberately left
 * out, so a field added to the element stops this compiling until somebody
 * says which it is -- a field quietly left out here is a way for two elements
 * to look alike again.
 */
export function webLlmElementDescription(element: WebLlmEvidenceElement): string {
  const parts: Record<keyof WebLlmEvidenceElement, unknown> = {
    // The handle is what is being chosen; it cannot be what tells two apart.
    target: undefined,
    tag: element.tag,
    frameId: element.frameId,
    role: element.role,
    name: element.name,
    text: element.text,
    inputType: element.inputType,
    controlType: element.controlType,
    href: element.href,
    options: element.options,
    revealKind: element.revealKind,
    form: element.form,
    landmark: element.landmark,
    heading: element.heading,
    item: element.item,
    cell: element.cell,
    dialog: element.dialog,
    within: element.within,
    alike: element.alike,
    // State and counts: they change as the Flow runs, or describe the page's rows rather than this element.
    hasValue: undefined,
    selectedValue: undefined,
    expanded: undefined,
    focused: undefined,
    recent: undefined,
    changed: undefined,
    repeats: undefined
  };
  return JSON.stringify(Object.values(parts));
}

/** Top to bottom, then left to right; an element the page gave no position keeps its place in the packet, after those it did. */
function topToBottom(cues: ReadonlyMap<string, WebLlmLookAlikeCues>, elements: readonly WebLlmEvidenceElement[]) {
  const packetOrder = new Map(elements.map((element, index) => [element.target, index]));
  return (left: WebLlmEvidenceElement, right: WebLlmEvidenceElement): number => {
    const a = cues.get(left.target)?.position;
    const b = cues.get(right.target)?.position;
    if (a && b && (a.top !== b.top || a.left !== b.left)) return a.top - b.top || a.left - b.left;
    if (a && !b) return -1;
    if (b && !a) return 1;
    return (packetOrder.get(left.target) ?? 0) - (packetOrder.get(right.target) ?? 0);
  };
}
