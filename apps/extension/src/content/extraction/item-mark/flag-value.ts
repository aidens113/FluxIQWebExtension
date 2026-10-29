// What a `flag` mark's column holds on one row (contract CC2): a value only
// where the item states the flag.
//
// A flag is an attribute an item states about itself (`./flag-attribute.ts`),
// and a page writes one in three ways: present with no value
// (`<li data-promoted>`), `"true"` or `"false"`, or a value of its own
// (`data-ad-id="81"`). Read as a plain attribute, the first is `""` -- which
// Core's condition judge reads as no value -- and `"false"` is a value, so
// `where {field, is: "present"}` kept exactly the wrong rows in both cases.
//
// So a flag holds the attribute's own value where it has words other than
// `true`, the attribute's name where it is written empty or `"true"` (the
// name is page structure, the column's own label), and nothing where it is
// absent or written `"false"`. A flag with words of its own reads exactly as
// the plain attribute always did.

/** The flag's value on the element, or `undefined` where the element does not state it. */
export function flagValue(element: Element, attribute: string): string | undefined {
  const written = element.getAttribute(attribute);
  if (written === null) return undefined;
  const token = written.trim().toLowerCase();
  if (token === "false") return undefined;
  return token === "" || token === "true" ? attribute : written;
}
