// The set of options each element sits in, and the line a set named only by
// ARIA gets (t610).
//
// t605 named a control's group from the `<legend>` of its nearest `<fieldset>`
// (`context.fieldsetLegend`, `../elements.ts`, `group`). Many sites draw an
// option set without one: a `<div role="radiogroup" aria-labelledby="…">` or a
// `<div role="group" aria-label="…">`. Both are in the packet like any rendered
// element, with the parent chain that places every element under them
// (`./page-tree.ts`), so the group is read here, from the packet, and the
// view's lines, a search's matches and a description all ask this one place.
//
// The nearest named group around an element wins, whether a fieldset or an
// ARIA group; an unnamed one -- a fieldset with no legend, a `role="group"`
// with neither `aria-label` nor `aria-labelledby` -- names nothing, and the
// walk goes on up. An ARIA group's name is its accessible name, which the
// capture already resolves from `aria-labelledby` (else `aria-label`), and,
// where the capture gave none, the words of the packet elements its
// `aria-labelledby` points at. As with a legend, a group that is the element's
// own words says nothing and is dropped.
//
// A legend is a line of its own. An ARIA group's name is on no element unless
// `aria-labelledby` points at one, so a named ARIA group gets a text line of
// its name, before its options, as a legend does -- except where a line
// already says it: the element its `aria-labelledby` points at has a line,
// or a fieldset's legend around it or inside it says the same words.

import type { WebLlmEvidenceElement } from "../elements";
import { attributeValue, normalisedWords, webLlmViewTraits } from "./element";
import type { WebLlmPageTree } from "./page-tree";

export type WebLlmGroupNames = {
  /** The name of the nearest named group around the element, unless it is the element's own words. */
  groupOf(element: WebLlmEvidenceElement): string | undefined;
  /** For a named ARIA group whose name no other line says: the words of its own line. */
  lineOf(element: WebLlmEvidenceElement): string | undefined;
};

const ARIA_GROUP_ROLES: ReadonlySet<string> = new Set(["group", "radiogroup"]);

/** The groups of a packet's elements, read through its tree. */
export function webLlmGroupNames(elements: readonly WebLlmEvidenceElement[], tree: WebLlmPageTree): WebLlmGroupNames {
  const byId = new Map<string, WebLlmEvidenceElement>();
  const legendOf = new Map<string, WebLlmEvidenceElement>();
  for (const element of elements) {
    const id = attributeValue(element, "id")?.trim();
    if (id !== undefined && id !== "" && !byId.has(id)) byId.set(id, element);
    if (element.tag === "legend" && element.parent !== undefined && !legendOf.has(element.parent)) legendOf.set(element.parent, element);
  }
  const legendWords = (fieldset: WebLlmEvidenceElement): string | undefined => {
    const legend = legendOf.get(fieldset.target);
    return legend === undefined ? undefined : wordsOf(legend);
  };
  const labelledBy = (group: WebLlmEvidenceElement): WebLlmEvidenceElement[] => (attributeValue(group, "aria-labelledby") ?? "")
    .split(/\s+/u)
    .flatMap((id) => {
      const labelling = id === "" ? undefined : byId.get(id);
      return labelling === undefined ? [] : [labelling];
    });
  const ariaName = (group: WebLlmEvidenceElement): string | undefined => {
    if (!isAriaGroup(group)) return undefined;
    const labelled = cleaned(attributeValue(group, "aria-labelledby")) !== undefined;
    const label = cleaned(attributeValue(group, "aria-label"));
    if (!labelled && label === undefined) return undefined;
    const resolved = labelled ? cleaned(labelledBy(group).map(wordsOf).filter((words) => words !== undefined).join(" ")) : undefined;
    return cleaned(group.name) ?? resolved ?? label;
  };
  // The nearest named group around the element, its own words not yet set aside.
  const nearest = (element: WebLlmEvidenceElement): string | undefined => {
    let fieldsetSeen = false;
    for (const ancestor of tree.ancestors(element)) {
      let name: string | undefined;
      if (ancestor.tag === "fieldset") {
        // The nearest fieldset is the one the capture read the legend of; the
        // legend's own group was dropped for being its own words.
        name = fieldsetSeen ? legendWords(ancestor) : cleaned(element.group) ?? (legendOf.get(ancestor.target) === element ? wordsOf(element) : undefined);
        fieldsetSeen = true;
      } else {
        name = ariaName(ancestor);
      }
      if (name !== undefined) return name;
    }
    // A packet without the fieldset in its tree still carries its legend.
    return fieldsetSeen ? undefined : cleaned(element.group);
  };
  return {
    groupOf: (element) => {
      const name = nearest(element);
      return name === undefined || isOwnWords(element, name) ? undefined : name;
    },
    lineOf: (element) => {
      const name = ariaName(element);
      if (name === undefined) return undefined;
      const said = normalisedWords(name);
      if (labelledBy(element).some(hasLine)) return undefined;
      const around = nearest(element);
      if (around !== undefined && normalisedWords(around) === said) return undefined;
      const inside = elements.some((other) => other.tag === "legend" && tree.isUnder(other, element) && normalisedWords(wordsOf(other) ?? "") === said);
      return inside ? undefined : name;
    }
  };
}

/** Whether the element gets a line of its own in the view: a visible element with a line role (`./element/traits.ts`). */
function hasLine(element: WebLlmEvidenceElement): boolean {
  const traits = webLlmViewTraits(element);
  return traits.visible && traits.lineRole !== undefined;
}

function isAriaGroup(element: WebLlmEvidenceElement): boolean {
  const role = element.role?.trim().split(/\s+/u)[0]?.toLowerCase();
  return role !== undefined && ARIA_GROUP_ROLES.has(role);
}

/** An element's words, as a legend's or a label's line reads them. */
function wordsOf(element: WebLlmEvidenceElement): string | undefined {
  return cleaned(element.ownText) ?? cleaned(element.text) ?? cleaned(element.name);
}

function isOwnWords(element: WebLlmEvidenceElement, name: string): boolean {
  const said = normalisedWords(name);
  return [element.name, element.text].some((words) => words !== undefined && normalisedWords(words) === said);
}

/** Whitespace collapsed and trimmed; `undefined` for nothing. */
function cleaned(words: string | undefined): string | undefined {
  const collapsed = words?.replace(/\s+/gu, " ").trim();
  return collapsed === undefined || collapsed === "" ? undefined : collapsed;
}
