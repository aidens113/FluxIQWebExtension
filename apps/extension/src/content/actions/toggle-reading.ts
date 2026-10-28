// What the live target says of its toggle state right now (t775): each state it
// states for itself -- aria-pressed, aria-checked, aria-selected, a native
// checkbox or radio's checked -- and its accessible name, in the shape the
// domain's signature derive and match read.

import { webToggleClassTokens, webToggleControlAncestor, type WebToggleAttribute, type WebToggleReading } from "@fluxiq-web-extension/domain/client";
import type { DomElementDescriptor } from "../../shared/protocol";

export function toggleReadingOf(element: Element, described: DomElementDescriptor): WebToggleReading {
  const states: Partial<Record<WebToggleAttribute, boolean>> = {};
  for (const attribute of ["aria-pressed", "aria-checked", "aria-selected"] as const) {
    const value = element.getAttribute(attribute)?.trim().toLowerCase();
    if (value === "true") states[attribute] = true;
    else if (value === "false") states[attribute] = false;
  }
  const input = element as Partial<HTMLInputElement>;
  if (element.tagName?.toLowerCase() === "input" && (input.type === "checkbox" || input.type === "radio") && typeof input.checked === "boolean") states.checked = input.checked;
  return { states, name: described.accessibleName ?? described.name ?? described.text ?? "", classes: classLevels(element) };
}

/** The element's class tokens, then those of each wrapper above it that is still part of the same control. */
function classLevels(element: Element): string[][] {
  const levels = [webToggleClassTokens(element.getAttribute?.("class"))];
  let up: Element | null = element;
  for (let level = 1; up?.parentElement; level += 1) {
    const parent: Element = up.parentElement;
    if (!webToggleControlAncestor(level, parent.tagName?.toLowerCase(), parent.getAttribute?.("role") ?? undefined)) break;
    levels.push(webToggleClassTokens(parent.getAttribute?.("class")));
    up = parent;
  }
  return levels;
}
