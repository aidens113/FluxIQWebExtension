// Which form controls hold a value of the record, and what kind of control
// each one is.
//
// **Why this exists.** On the everything store's cart, a live build asked for
// the columns "item, quantity and price". It bound `quantity` to the one
// `value` column the detection offered, and that column was the line's select
// checkbox. Every row then read `"on"` (`lane-run-mum06sfc-f1d9403f.md`, cause 2).
// `"on"` is what HTML gives a checkbox or radio button with no `value`
// attribute, on every page and for every item, so it is never data. The
// column's label was its path through hashed class names
// (`div > input.x1a2b`), so nothing told the model it was a checkbox.
//
// So a control is described by its own type, which the page's markup states.
// No value is read:
//
// - a checkbox or radio button holds a record value only when the page wrote
//   one into its `value` attribute, such as an item id on a row's select box.
//   Without that attribute its value is the constant `"on"`, so it is not
//   offered and not read;
// - a button-like input (`button`, `submit`, `reset`, `image`) has its caption
//   as its value, and a `file` input has a path the browser invents. Neither
//   is a value of the record;
// - every other control holds what a person typed or chose, and is described
//   by its type (`number`, `text`, `select`, `textarea`), so a label can say
//   `number control` where it used to say only where the control sits.

/** Input types whose `value` is a caption or a browser-made path, never a value of the record. */
const NOT_DATA_INPUT_TYPES: ReadonlySet<string> = new Set(["button", "submit", "reset", "image", "file"]);

/** Input types whose `value` is a fixed submission token, `"on"` when the page wrote none. */
const CHOICE_INPUT_TYPES: ReadonlySet<string> = new Set(["checkbox", "radio"]);

/** An input type the label can carry as written. Anything else is read as `text`, as the browser reads an unknown type. */
const PLAIN_INPUT_TYPE = /^[a-z][a-z-]{0,23}$/u;

/**
 * The kind of control this element is when its live `value` is a value of the
 * record: its input type, or `select` or `textarea`. `undefined` for an element
 * that is not a form control, or one whose `value` is never record data (see
 * above). Reads the tag and the `type` and `value` attributes, never the value.
 */
export function recordControlType(element: Pick<Element, "tagName" | "getAttribute" | "hasAttribute">): string | undefined {
  const tag = element.tagName.toLowerCase();
  if (tag === "select" || tag === "textarea") return tag;
  if (tag !== "input") return undefined;
  const written = (element.getAttribute("type") ?? "").trim().toLowerCase();
  const type = PLAIN_INPUT_TYPE.test(written) ? written : "text";
  if (NOT_DATA_INPUT_TYPES.has(type)) return undefined;
  if (CHOICE_INPUT_TYPES.has(type) && !element.hasAttribute("value")) return undefined;
  return type;
}
