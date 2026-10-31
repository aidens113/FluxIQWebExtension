// A control's own accessible name, as a person would read it (t810): its
// `aria-label`, else its words, else its `title`, whitespace collapsed. Only the
// control's own; an ancestor's label does not name it.

/** The control's name, or the empty string when it has none. */
export function controlName(control: Element): string {
  const label = clean(control.getAttribute("aria-label"));
  if (label) return label;
  return clean(control.textContent) || clean(control.getAttribute("title"));
}

function clean(value: string | null): string {
  return (value ?? "").replace(/\s+/gu, " ").trim();
}
