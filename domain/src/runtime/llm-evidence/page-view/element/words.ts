// The words the page view prints for one element (t223, "Words"), whole:
//
//  - a control: the first of `name`, `text`, `label`, its `placeholder` and its
//    `title` attribute that says anything;
//  - a layer: its name;
//  - a semantic text element (p, li, td, a heading...): `text`, else `name` --
//    all of its descendants' words, which is why the lines under it fold;
//  - any other text: its own words;
//  - an image: its alt.
//
// Every one passes rule W1 (`./doubling.ts`), so a price written twice for a
// screen reader prints once.

import type { WebLlmEvidenceElement } from "../../elements";
import { attributeValue } from "./attribute-value";
import { undoubledWords } from "./doubling";
import { meaningfulWords } from "./meaningful";
import { webLlmViewTraits } from "./traits";

/**
 * The element's readable words (`readable`) in place of `words` when the two
 * differ only by spacing: words the capture read from several blocks, run
 * together, are printed apart -- "Pickup or delivery? Carden Falls
 * Supercenter", not "Pickup or delivery?Carden Falls Supercenter" (lane B's
 * bigbox run, 2026-10-01). Words from anywhere else, an authored name, are
 * printed as they are.
 */
function readable(element: WebLlmEvidenceElement, words: string | undefined): string | undefined {
  const spaced = element.readable;
  if (words === undefined || spaced === undefined) return words;
  return spaced.replace(/\s+/gu, "") === words.replace(/\s+/gu, "") ? spaced : words;
}

/** What a line for this element says, or `undefined` when it says nothing (a control with no words, an element that gets no line). */
export function webLlmElementWords(element: WebLlmEvidenceElement): string | undefined {
  const traits = webLlmViewTraits(element);
  const words = rawWords(element, traits);
  if (words === undefined) return undefined;
  const printed = undoubledWords(words);
  return printed === "" ? undefined : printed;
}

function rawWords(element: WebLlmEvidenceElement, traits: ReturnType<typeof webLlmViewTraits>): string | undefined {
  switch (traits.lineRole) {
    case "control":
      return readable(element, [element.name, element.text, element.label, attributeValue(element, "placeholder"), attributeValue(element, "title")]
        .find((candidate) => candidate !== undefined && candidate.trim() !== ""));
    case "layer":
      return element.name;
    case "text":
      return traits.semantic ? readable(element, element.text ?? element.name) : traits.ownWords;
    case "image":
      return meaningfulWords(element.name) ? element.name : undefined;
    default:
      return undefined;
  }
}
