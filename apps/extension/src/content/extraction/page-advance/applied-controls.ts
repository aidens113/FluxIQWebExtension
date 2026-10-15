// The narrowing a page shows as applied: every checked checkbox or radio, every
// selected option, and every pressed or checked toggle, as the name and value
// each carries. A query parameter a Next drops counts as the list's scope only
// when one of these shows it (`./dropped-state.ts`), so a parameter nothing on
// the page shows -- a tracking tag the page arrived with -- is not mistaken for
// a filter. Names and values are read only to compare them with the address;
// none is carried anywhere.
//
// **A single select on its first option shows nothing applied** (t626). A
// select always has an option selected: with none marked, the browser selects
// the first, so a selected first option is what the select shows when nobody
// chose anything -- and by the convention forms follow, the first option is
// the one that narrows nothing ("All", "Any", "Best match"). A store's search
// box carried its department select, on "All", in every results address it
// submitted, and its Next left that parameter out; counted as applied, it
// failed every Next from a typed search (A8 wave 6, run mv9a48cs steps 0023
// and 0031). A later option is a choice someone made, and still counts. A
// select that takes several options has no such default -- nothing is
// selected until someone selects it -- so each of its selected options
// counts, the first one included.
//
// **So does a named radio group on its first radio** (t626 follow-up). A
// group of radios is a select drawn as buttons, and filter rails draw it with
// the same convention: its first radio is the one that narrows nothing ("Any
// price", "All sellers"), and a page drawn from its address checks it when no
// filter is set. Counted as applied, it would fault every Next that leaves the
// match-everything value out, which is the defect above in another form. The
// group is the radios of one name in the radio's own form, or under `root`
// when it has none. A radio with no name is no group, and a later radio is a
// choice, so both still count. The price: a group whose first radio does
// narrow, checked, is not seen as applied, and a Next that drops it is
// followed as it was before t623.

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
    if (option ? isUnchosenDefault(element) : isUnchosenFirstRadio(element, root)) continue;
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

/** Whether `option` is the first option of a select that takes one option: the choice the select shows when nobody made one (see the header). */
function isUnchosenDefault(option: Element): boolean {
  const select = option.closest("select");
  if (!select || select.getAttribute("multiple") !== null) return false;
  return select.querySelector("option") === option;
}

/** Whether `input` is a radio that is the first of its named group, its form's or else `root`'s (see the header). */
function isUnchosenFirstRadio(input: Element, root: ParentNode): boolean {
  if (input.tagName !== "INPUT" || (input.getAttribute("type") ?? "").toLowerCase() !== "radio") return false;
  const name = nonEmpty(input.getAttribute("name"));
  if (name === undefined) return false;
  const scope: ParentNode = input.closest("form") ?? root;
  const first = Array.from(scope.querySelectorAll("input")).find((other) => (other.getAttribute("type") ?? "").toLowerCase() === "radio" && nonEmpty(other.getAttribute("name")) === name);
  return first === input;
}

function liveFlag(element: Element, flag: "checked" | "selected"): boolean | undefined {
  const value = (element as unknown as Record<string, unknown>)[flag];
  return typeof value === "boolean" ? value : undefined;
}

function nonEmpty(text: string | null | undefined): string | undefined {
  const trimmed = text?.trim();
  return trimmed ? trimmed : undefined;
}
