// The element one field of a record reads, found from the item the record is
// read off (`../field-reader.ts`, `../infer-fields.ts`).
//
// A field names its element by a selector inside the item, and three things
// besides:
//
// - no selector, or `:scope` alone, is the item itself (t903: `querySelector`
//   searches the item's descendants and never returns the item);
// - `:scope` followed at once by more of one compound -- `:scope[aria-disabled
//   ="true"]` -- is the item itself while it matches the rest, and nothing
//   otherwise. That is how a state mark reads the item's own state: a column
//   with a value only while the item is pressed, selected or disabled
//   (`../item-mark/`, t885 R1);
// - a `group` names the group the item sits in, its nearest ancestor that
//   matches it, and the selector is read inside that group instead: a grid of
//   grouped controls read one row per control carries its group's heading so
//   (`../cell-run/`, t885 R2).
//
// A group the item is not in names nothing. A selector the browser cannot read
// throws, as `querySelector` always has here.

/** `:scope` followed by more of the same compound: the item itself under a condition. */
const ITEM_UNDER_CONDITION = /^:scope(?=[[.:#])/u;

/** The element the field names for this item, or `null` where it names none; see the header. */
export function fieldElement(item: Element, selector: string | undefined, group?: string): Element | null {
  const base = group === undefined ? item : groupOf(item, group);
  if (base === null) return null;
  if (selector === undefined || selector === "" || selector === ":scope") return base;
  const condition = selector.slice(":scope".length);
  if (ITEM_UNDER_CONDITION.test(selector) && oneCompound(condition)) return base.matches(condition) ? base : null;
  return base.querySelector(selector);
}

/** The item's nearest ancestor the group selector names, or `null` when it sits in none. */
function groupOf(item: Element, group: string): Element | null {
  return item.parentElement?.closest(group) ?? null;
}

/** Whether the condition is one compound: no combinator or list outside its brackets, parentheses and quotes. */
function oneCompound(condition: string): boolean {
  const bare = condition.replace(/"(?:[^"\\]|\\.)*"/gu, "").replace(/\[[^\]]*\]/gu, "").replace(/\([^()]*\)/gu, "");
  return !/[\s>+~,]/u.test(bare);
}
