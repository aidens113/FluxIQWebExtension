// The identifiers an author wrote to name an element, in the order a selector
// prefers them: its id, its test id (`data-testid`, `data-test`, `data-cy`, the
// order the common tools write one), and its form name.
//
// Each comes spelled two ways. `selector` names the element on its own --
// `#save`, `[data-testid="save"]`, `input[name="email"]` -- and is what a
// snapshot carries when the page holds it once. `qualifier` narrows a
// structural step -- `#save`, `[data-testid="save"]`, `[name="email"]` -- so a
// positional selector still says which control it means.
//
// Only identifiers, never a word the page shows or a value a control holds: no
// text, value, placeholder, label, title or href. These three attributes are
// already on every descriptor's `attributes`, so a selector built from them
// says nothing about a page -- sensitive region or not -- that the descriptor
// beside it does not already say.
//
// Attributes are read with `getAttribute`, not the `id` property: a `<form>`
// holding an `<input name="id">` answers `form.id` with that input.

/** One identifier, as a selector that stands alone and as a qualifier on a step. */
export type ElementAnchor = { selector: string; qualifier: string };

const TEST_ID_ATTRIBUTES = ["data-testid", "data-test", "data-cy"] as const;

/** The element's anchors, strongest first; empty when the author named it by nothing. */
export function elementAnchors(element: Element): ElementAnchor[] {
  const anchors: ElementAnchor[] = [];
  const id = element.getAttribute("id");
  if (id) {
    const byId = `#${CSS.escape(id)}`;
    anchors.push({ selector: byId, qualifier: byId });
  }
  for (const attribute of TEST_ID_ATTRIBUTES) {
    const testId = element.getAttribute(attribute);
    if (!testId) continue;
    const byTestId = `[${attribute}="${CSS.escape(testId)}"]`;
    anchors.push({ selector: byTestId, qualifier: byTestId });
  }
  const name = element.getAttribute("name");
  if (name) {
    const byName = `[name="${CSS.escape(name)}"]`;
    anchors.push({ selector: `${CSS.escape(element.localName)}${byName}`, qualifier: byName });
  }
  return anchors;
}
