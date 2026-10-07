// The words the page view prints for one element (t223, "Words"), whole:
//
//  - a control: the first of `name`, `text`, `label` and its `title` attribute
//    that says anything -- never its placeholder, which is an example or an
//    advertisement rather than what the field is, and is printed apart as
//    `placeholder "…"` (`./state-tokens.ts`, t229); a name that is only the
//    placeholder is passed over the same way (`placeholderName`). A control
//    the page only drew (`drawn`: a `<div>` with a listener or a pointer) says
//    its own words in place of `text`, which holds every word under it, a
//    closed flyout's included; the words of its children keep their lines;
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
import { webLlmReadableWords } from "./readable-words";
import { webLlmViewTraits } from "./traits";

/**
 * What a line for this element says, or `undefined` when it says nothing (a
 * control with no words, an element that gets no line). `delegate` as in
 * `webLlmViewTraits`: a delegate's line says what its text line would.
 */
export function webLlmElementWords(element: WebLlmEvidenceElement, delegate = false): string | undefined {
  const traits = webLlmViewTraits(element, delegate);
  const words = rawWords(element, traits);
  if (words === undefined) return undefined;
  const printed = undoubledWords(words);
  return printed === "" ? undefined : printed;
}

function rawWords(element: WebLlmEvidenceElement, traits: ReturnType<typeof webLlmViewTraits>): string | undefined {
  switch (traits.lineRole) {
    case "control":
      return webLlmReadableWords(element, [element.placeholderName === true ? undefined : element.name, traits.drawn ? traits.ownWords : element.text, element.label, attributeValue(element, "title")]
        .find((candidate) => candidate !== undefined && candidate.trim() !== ""));
    case "layer":
      return element.name;
    case "text":
      return traits.semantic ? webLlmReadableWords(element, element.text ?? element.name) : traits.ownWords;
    case "image":
      return meaningfulWords(element.name) ? element.name : undefined;
    default:
      return undefined;
  }
}
