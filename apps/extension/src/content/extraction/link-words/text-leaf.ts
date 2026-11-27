import { textOutsideSensitiveControls } from "../../sensitive-text";

/**
 * Whether the element holds words of its own and no elements: the unit a
 * link's words are measured in (`own-words.ts`) and the unit inference offers
 * as a text column (`../infer-fields.ts`), one rule for both so they cannot
 * disagree. The text is read through the one sensitive-text reader, so a
 * marked control's contents do not even decide that a field exists, and it is
 * never carried anywhere.
 */
export function isTextLeaf(element: Element): boolean {
  return element.children.length === 0 && textOutsideSensitiveControls(element).replace(/\s+/gu, " ").trim() !== "";
}
