// Which of an element's attributes state a value its words do not.

import { isWithinSensitiveControl, textOutsideSensitiveControls } from "../../sensitive-text";
import { constantBadgeName } from "../badge-name";

/** The attributes any element can state a value in, beside its words. */
const NAMING_ATTRIBUTES: readonly string[] = ["aria-label", "title"];

/**
 * The attributes the element, found by `selector` in each of `peers`, states a
 * value in that differs from the words it shows, in the order above, with a
 * `time` element's `datetime` last.
 *
 * Nothing for an element inside a sensitive control, which is never read, and
 * no `aria-label` or `title` for one that shows no words: that element is a
 * badge, whose name `../badge-name.ts` already offers. An attribute every peer
 * that has the element states alike is left out. The words and the attribute
 * are compared here and never kept.
 */
export function statedAttributes(element: Element, selector: string, peers: readonly Element[]): string[] {
  if (isWithinSensitiveControl(element)) return [];
  const shown = collapsed(textOutsideSensitiveControls(element));
  const names = [...(shown === "" ? [] : NAMING_ATTRIBUTES), ...(element.tagName.toLowerCase() === "time" ? ["datetime"] : [])];
  return names.filter((name) => {
    const stated = collapsed(element.getAttribute(name) ?? "");
    return stated !== "" && stated !== shown && constantBadgeName(peers, selector, name) === undefined;
  });
}

function collapsed(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}
