import { isVisibleForResolution } from "./visible";

/**
 * Whether a match is worth choosing between: of the recorded tag, where the
 * recording named one, visible, and enabled.
 */
export function passesResolutionGate(element: Element, recordedTag: string | undefined): boolean {
  if (recordedTag && element.tagName.toLowerCase() !== recordedTag.toLowerCase()) return false;
  return isVisibleForResolution(element) && isEnabledForResolution(element);
}

/** Enabled by the platform's rule, which covers a disabled `<fieldset>`'s descendants, plus the ARIA claim. */
function isEnabledForResolution(element: Element): boolean {
  if (element.matches(":disabled")) return false;
  return !element.closest('[aria-disabled="true"]');
}
