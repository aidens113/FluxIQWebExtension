// The narrowing a page shows as applied: every checked checkbox or radio, every
// selected option, and every pressed or checked toggle, as the name and value
// each carries. A query parameter a Next drops counts as the list's scope only
// when one of these shows it (`./dropped-state.ts`), so a parameter nothing on
// the page shows -- a tracking tag the page arrived with -- is not mistaken for
// a filter. Names and values are read only to compare them with the address;
// none is carried anywhere.

/** What one applied control carries: its form name and its value, where it has them. */
export type AppliedControl = { name: string | undefined; value: string | undefined };

/** What a checked checkbox or radio with no `value` attribute submits. */
const DEFAULT_CHECKED_VALUE = "on";

/** What can show a choice as applied. A text field is not one: what it holds is typed, not chosen. */
const CHOICE_SELECTOR = 'input,option,[aria-pressed="true"],[aria-checked="true"]';

/** The controls under `root` that show a choice applied, with their names and values. */
export function appliedControls(root: ParentNode): AppliedControl[] {
  const applied: AppliedControl[] = [];
  for (const element of Array.from(root.querySelectorAll(CHOICE_SELECTOR))) {
    if (!isApplied(element)) continue;
    const option = element.tagName === "OPTION";
    const name = nonEmpty(element.getAttribute("name") ?? (option ? element.closest("select")?.getAttribute("name") : null));
    const value = nonEmpty(element.getAttribute("value") ?? (option ? element.textContent : element.tagName === "INPUT" ? DEFAULT_CHECKED_VALUE : null));
    // A checked or selected choice worth nothing -- "Any language" -- shows
    // that nothing is applied, whatever its name.
    if ((option || element.tagName === "INPUT") && value === undefined) continue;
    if (name !== undefined || value !== undefined) applied.push({ name, value });
  }
  return applied;
}

/**
 * Whether the control shows its choice as applied: a checkbox or radio
 * checked, an option selected -- each by its live state where the element has
 * one, else by its attribute -- or a toggle pressed or checked.
 */
function isApplied(element: Element): boolean {
  if (element.tagName === "INPUT") {
    const type = (element.getAttribute("type") ?? "").toLowerCase();
    if (type !== "checkbox" && type !== "radio") return false;
    return liveFlag(element, "checked") ?? element.getAttribute("checked") !== null;
  }
  if (element.tagName === "OPTION") return liveFlag(element, "selected") ?? element.getAttribute("selected") !== null;
  return element.getAttribute("aria-pressed") === "true" || element.getAttribute("aria-checked") === "true";
}

function liveFlag(element: Element, flag: "checked" | "selected"): boolean | undefined {
  const value = (element as unknown as Record<string, unknown>)[flag];
  return typeof value === "boolean" ? value : undefined;
}

function nonEmpty(text: string | null | undefined): string | undefined {
  const trimmed = text?.trim();
  return trimmed ? trimmed : undefined;
}
