// What one look at a control says of its toggle state, read off a page
// capture's evidence (t775): each state it states for itself, its accessible
// name, and the class tokens its element and the wrappers within the same
// control carry. One reader for the press that learns a signature
// (`../node-run/press-effect/toggle-signature.ts`) and for the look that reads
// a control against what was learned (`./control-view.ts`).

import type { WebToggleAttribute, WebToggleReading } from "../../../actions/toggle-signature";
import { webToggleClassTokens, webToggleControlAncestor } from "../../../actions/toggle-signature";
import type { WebLlmEvidenceElement } from "../elements";
import { attributeValue } from "../page-view";

/** `element` read as a toggle, with `elements` the capture it is one of (its wrappers are found there). */
export function webToggleReadingOf(element: WebLlmEvidenceElement, elements: readonly WebLlmEvidenceElement[]): WebToggleReading {
  const states: Partial<Record<WebToggleAttribute, boolean>> = {};
  for (const attribute of ["aria-pressed", "aria-checked", "aria-selected"] as const) {
    const value = attributeValue(element, attribute)?.trim().toLowerCase();
    if (value === "true") states[attribute] = true;
    else if (value === "false") states[attribute] = false;
  }
  if (element.checked !== undefined) states.checked = element.checked;
  return { states, name: element.name ?? element.text ?? "", classes: classLevels(element, elements) };
}

/** The element's class tokens, then those of each wrapper above it that is still part of the same control. */
function classLevels(element: WebLlmEvidenceElement, elements: readonly WebLlmEvidenceElement[]): string[][] {
  const levels = [webToggleClassTokens(attributeValue(element, "class"))];
  let up = element;
  for (let level = 1; up.parent !== undefined; level += 1) {
    const parent = elements.find((candidate) => candidate.target === up.parent);
    if (parent === undefined || !webToggleControlAncestor(level, parent.tag, parent.role)) break;
    levels.push(webToggleClassTokens(attributeValue(parent, "class")));
    up = parent;
  }
  return levels;
}
