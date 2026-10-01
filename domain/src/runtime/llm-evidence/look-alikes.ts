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
//   identity/record.ts`) -- where those words differ between them, and whether
//   or not their places in a list or table differ: "item 3 of 4" is a
//   different string, not a store's name (`placeFreeDescription`);
// - and, for any that still read the same, `alike`: which of them this is, top
//   to bottom on the page, and how many there are in this packet.
//
// One element is a look-alike with nothing beside it in the packet: the example
// the capture keeps of a control every row repeats, carrying `repeats`, whose
// copies are listed after every distinct element or not at all
// (`apps/extension/src/content/repeat-exemplars.ts`). It is given `within`
// whenever its record has words. Without them it reads as *the* "Set as my
// store" or *the* "Add to cart", and a model that wants another row's presses
// it anyway: live run `run-munpjclw-52592f43` set the wrong store twice that
// way. With them it reads as the first row's, and `repeats` says there are
// others.
//
// All three are closed: two page strings already screened, and a pair of
// counts. After them no two elements of a packet have the same description,
// which is the property the tests hold.
//
// What "the same" means is every field that says what the element is and where
// it sits, less its attributes, which on a repeated row differ only by ids and
// classes nobody reads. State -- a value, a check, a selection,
// focus, whether it was just touched -- is not identity: it changes as the Flow
// runs, and "the one that is filled" is not a control anybody can find again.
// Nor is the measured box or whether it is on screen: every element has its own
// box, so counting it would make no two elements alike, and which of them is
// higher on the page is what `alike` already says. `repeats` is a count of the
// page's alike rows, not a fact about this element, and the handle is what is
// being chosen, so neither counts either.

import type { WebLlmEvidenceElement } from "./elements";

/** What the page says about an element beyond what it is, published only where it tells two look-alikes apart, or says which row a repeated control's example is in. */
export type WebLlmLookAlikeCues = {
  /** The words of the row, card or list item the element sits in, already screened. */
  within?: string | undefined;
  /** The name of the open dialog the element sits in, already screened. */
  dialog?: string | undefined;
  /** Where the element starts on the page, for counting look-alikes top to bottom. */
  position?: { top: number; left: number } | undefined;
};

/** The cues that are published, in the order they are tried. */
const CUES = ["dialog", "within"] as const;

/**
 * Give every element of `elements` that reads like another the cues that tell
 * them apart, in place. Any cue a previous call wrote is cleared first, so a
 * second call counts the look-alikes as they are now.
 */
export function tellWebLlmLookAlikesApart(elements: WebLlmEvidenceElement[], cues: ReadonlyMap<string, WebLlmLookAlikeCues>): void {
  for (const element of elements) {
    delete element.dialog;
    delete element.within;
    delete element.alike;
  }
  const groups = lookAlikeGroups(elements, placeFreeDescription);
  for (const group of groups) {
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
  // An example standing for copies the packet does not list is a look-alike
  // of those copies, with nothing in the packet to be told apart from.
  const grouped = new Set(groups.flat());
  for (const element of elements) {
    if (element.repeats === undefined || grouped.has(element)) continue;
    const within = cues.get(element.target)?.within;
    if (within !== undefined) element.within = within;
  }
  for (const group of lookAlikeGroups(elements, webLlmElementDescription)) {
    const ordered = [...group].sort(topToBottom(cues, elements));
    ordered.forEach((element, index) => {
      element.alike = { index: index + 1, total: ordered.length };
    });
  }
}

/**
 * The description less the element's place in a list or table. Used only to
 * decide who is given `dialog` and `within`: "item 3 of 4" makes two controls
 * different strings, but it does not say which store a "Set as my store" sets,
 * and on the store chooser, all three listed, it was all the buttons carried. A position is
 * what is left when the words are the same, which is what `alike` is for.
 */
function placeFreeDescription(element: WebLlmEvidenceElement): string {
  const { item: _item, cell: _cell, ...placeFree } = element;
  return webLlmElementDescription(placeFree);
}

/** Every set of two or more elements with one description, each in packet order. */
function lookAlikeGroups(elements: readonly WebLlmEvidenceElement[], describe: (element: WebLlmEvidenceElement) => string): WebLlmEvidenceElement[][] {
  const groups = new Map<string, WebLlmEvidenceElement[]>();
  for (const element of elements) {
    const key = describe(element);
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
    implicitRole: element.implicitRole,
    name: element.name,
    label: element.label,
    text: element.text,
    // Part of `text`, a handle, and a flag only a search capture sets: none
    // tells two elements apart for a person (t223).
    ownText: undefined,
    parent: undefined,
    hidden: undefined,
    // Not identity for this purpose: a row's copy of a control usually differs
    // only by a per-instance id or class nobody reads, and counting those
    // would withhold the row's words (`within`), which is what a person reads.
    attributes: undefined,
    inputType: element.inputType,
    controlType: element.controlType,
    hasClickHandler: element.hasClickHandler,
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
    value: undefined,
    checked: undefined,
    selectedValue: undefined,
    box: undefined,
    onViewport: undefined,
    expanded: undefined,
    focused: undefined,
    recent: undefined,
    changed: undefined,
    repeats: undefined,
    // What stands in front of the page (`layers.ts`): it changes as a dialog
    // opens or a wall is dismissed, and the handles it names are no cue a
    // person reads. The dialog two alike controls sit in is told by `dialog`.
    isDialog: undefined,
    inDialog: undefined,
    covers: undefined,
    coversCount: undefined,
    kind: undefined,
    coveredBy: undefined,
    frontLayer: undefined,
    statement: undefined
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
