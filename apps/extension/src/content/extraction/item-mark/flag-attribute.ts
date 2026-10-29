// Which of an item's own `data-*` attributes is a flag (contract CC2): an
// attribute that marks some items and not others, or one written only as a
// yes or a no.
//
// An item's attributes are already columns (`../item-attributes/`). Two kinds
// of them say something about a row by being there rather than by their value:
//
// - one only some of the run's items carry, whatever it holds -- the ad id on
//   a sponsored card says "this is an advertisement" by being on it;
// - one every carrier writes as `""`, `"true"` or `"false"`, whose value is
//   the yes or the no and nothing else.
//
// An attribute every item carries with values of their own (`data-item-id`)
// is the item's data, not a flag, and is left as it is. Only the tokens the
// markup itself uses for a yes or a no are read; no word of the page is.

/** The values a yes-or-no attribute is written with. */
const YES_OR_NO: ReadonlySet<string> = new Set(["", "true", "false"]);

/** Whether the item attribute `name` is a flag over the run (see the header). */
export function isFlagAttribute(run: readonly Element[], name: string): boolean {
  const carriers = run.filter((item) => item.hasAttribute(name));
  if (carriers.length === 0) return false;
  if (carriers.length < run.length) return true;
  return carriers.every((item) => YES_OR_NO.has((item.getAttribute(name) ?? "").trim().toLowerCase()));
}
