// The template signature of a repeating item, as a pure function of the parts
// the page reads off the element (C4).
//
// Two rows rendered from one template share a tag, a role, a test-id shape and
// the classes they are styled by, and the page groups siblings by exactly that
// string: page evidence to report a page's repeating runs, and the picker to
// find the run a picked element belongs to. The two must group identically, or
// the run the evidence reports is not the run the picker proposes, so the
// string is built once, here, and the page supplies only the parts.
//
// A test id is reduced to its shape (`pagination-page-1` becomes
// `pagination-page-#`), because a page that numbers its rows is still rendering
// one template: keying on the exact id would split every numbered run into
// singletons.
//
// Nothing here reads a page value. A tag, a role, a test id and class names are
// page structure, and a signature carries only their shape.

/** At most this many of an item's classes, sorted, enter its signature. */
const MAX_SIGNATURE_CLASSES = 3;

/** What the page reads off an item element to sign it. */
export type WebAutomationItemSignatureParts = {
  /** The element's tag name, in any case: `element.tagName`. */
  tagName: string;
  /** The raw `role` attribute, when there is one: `element.getAttribute("role")`. */
  role?: string | null | undefined;
  /** The element's test id, when it has one. */
  testId?: string | undefined;
  /** The element's classes, in any order: `element.classList`. */
  classes: Iterable<string>;
};

/** What two rows of the same template share: tag, role, test-id shape, and the classes they are styled by. */
export function webAutomationItemSignature(parts: WebAutomationItemSignatureParts): string {
  const role = parts.role?.trim().toLowerCase() ?? "";
  const classes = [...parts.classes].sort().slice(0, MAX_SIGNATURE_CLASSES).join(".");
  return `${parts.tagName.toLowerCase()}|${role}|${webAutomationIdentifierShape(parts.testId)}|${classes}`;
}

/** A test id with its numbers replaced, so `row-1` and `row-2` are one template rather than two. */
export function webAutomationIdentifierShape(value: string | undefined): string {
  return value === undefined ? "" : value.replace(/\d+/gu, "#");
}
