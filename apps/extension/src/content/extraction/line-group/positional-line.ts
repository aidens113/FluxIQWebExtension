// Whether a text line is named by its position, and if so the container that
// is offered whole beside it.

import { isWithinSensitiveControl, textOutsideSensitiveControls } from "../../sensitive-text";

/** How the item names an element: the selector a field reads it by and the label it is shown under. */
type ElementNamer = (element: Element) => { selector: string; label: string } | undefined;

/** What a group of lines is labelled after its container's path: a fixed phrase, never a value. */
const LINES_LABEL = "(all lines)";

/** A selector whose last step names its element by position among its parent's elements of that tag. */
const POSITIONAL_STEP = /:nth-of-type\(\d+\)$/u;

/**
 * For a text line whose selector names it by its position among its parent's
 * elements of its tag: the selector its parent is offered by as a group of
 * lines, and the group's selector and label the first time this item meets
 * that parent. `containers` is the item's own memo of each parent already
 * decided, `undefined` for one that is not offered.
 *
 * Nothing for a line named any other way, a line that is the item's own child
 * (the group would be the whole item), a container fewer than two of whose
 * children hold words, a sensitive one, or one `name` cannot name alone in the
 * item. The words are read through the one sensitive-text reader, only to count
 * the lines that hold some, and never kept.
 */
export function positionalLine(
  item: Element,
  element: Element,
  selector: string,
  name: ElementNamer,
  containers: Map<Element, string | undefined>
): { lineOf: string; group?: { selector: string; label: string } } | undefined {
  if (!POSITIONAL_STEP.test(selector)) return undefined;
  const container = element.parentElement;
  if (container === null || container === item) return undefined;
  if (containers.has(container)) {
    const known = containers.get(container);
    return known === undefined ? undefined : { lineOf: known };
  }
  const worded = Array.from(container.children).filter((child) => textOutsideSensitiveControls(child).trim() !== "").length;
  const named = worded >= 2 && !isWithinSensitiveControl(container) ? name(container) : undefined;
  containers.set(container, named?.selector);
  if (named === undefined) return undefined;
  return { lineOf: named.selector, group: { selector: named.selector, label: `${named.label} ${LINES_LABEL}` } };
}
