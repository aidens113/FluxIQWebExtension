// The current step's target, as the clearing needs it to leave the target's own
// layer alone (t401).
//
// A layer that holds, or is, the step's target is not interference: it is what
// the step works in. Until t401 the clearing was told the target only when the
// target resolved, as an element. A target the page had not drawn -- or that a
// step addresses by a selector the page no longer matches -- spared nothing, so
// the clearing closed the very dialog the step was aimed at. Live, the
// provider-free recovery matrix (rows 13a and 13b) watched it press the
// notification prompt's "Not now" between the attempts of the step whose
// target was that "Not now", after which the target was gone on every attempt
// and no Flow could choose an answer of its own in such a dialog.
//
// So the clearing is now given what the step says of its target, and a layer is
// the target's own when:
//
// - **the resolved target is inside it.** Exact, and when the target resolved
//   it is the only rule asked: a layer that does not hold it is in its way.
// - **the step's selector matches inside it.** A selector that matches more
//   than one element, or that the resolver vetoed, still says where the step is
//   working.
// - **it holds a control the step's recorded fingerprint names.** The step was
//   recorded or authored against a control called "Not now" or "Turn on"; a
//   layer offering one by that name is the layer the step is answering.
//
// A name is matched whole, against a control's own accessible name, title or
// leaf text, ignoring case and spacing. Only names a control could carry are
// read (`NAME_MAX`), so a fingerprint's paragraph of text never spares a layer
// for happening to mention a word.

import { composedContains, composedDescendants, openRootsWithin } from "../../shadow-dom";

/** What a step says of its target: the element it resolved to now, its selector, and the names it was recorded by. */
export type ClearingTarget = {
  element?: Element | undefined;
  selector?: string | undefined;
  names?: readonly string[] | undefined;
};

/** A name longer than this is prose, not a control's name. */
const NAME_MAX = 48;

/** At most this many elements of one layer are read for a control the target names. */
const NAME_SCAN_LIMIT = 400;

/** Whether `layer` is, or holds, the step's target, by the rules the file comment gives. */
export function layerHoldsTarget(layer: Element, target: ClearingTarget | undefined): boolean {
  if (!target) return false;
  if (target.element && target.element.isConnected !== false) return composedContains(layer, target.element);
  if (target.selector && selectorMatchesWithin(layer, target.selector)) return true;
  const names = (target.names ?? []).map(normalized).filter((name) => name.length > 0 && name.length <= NAME_MAX);
  return names.length > 0 && holdsNamedControl(layer, new Set(names));
}

/** Whether the selector matches the layer or anything in it, shadow roots included. A selector the page cannot parse matches nothing. */
function selectorMatchesWithin(layer: Element, selector: string): boolean {
  try {
    if (typeof layer.matches === "function" && layer.matches(selector)) return true;
    if (typeof layer.querySelector === "function" && layer.querySelector(selector)) return true;
    return openRootsWithin(layer).some((root) => root.querySelector(selector) !== null);
  } catch {
    return false;
  }
}

function holdsNamedControl(layer: Element, names: ReadonlySet<string>): boolean {
  let scanned = 0;
  for (const element of composedDescendants(layer)) {
    if (++scanned > NAME_SCAN_LIMIT) return false;
    if (ownNames(element).some((name) => names.has(name))) return true;
  }
  return false;
}

function ownNames(element: Element): string[] {
  const names = [element.getAttribute("aria-label"), element.getAttribute("title")];
  if (element.childElementCount === 0) names.push(element.textContent);
  return names.map((name) => normalized(name ?? "")).filter((name) => name.length > 0);
}

function normalized(text: string): string {
  return text.replace(/\s+/gu, " ").trim().toLowerCase();
}
