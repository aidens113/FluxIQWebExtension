// The item's own `data-*` attributes as columns, read off the item itself
// (moved out of `../infer-fields.ts` in t800, with the flag mark added).
//
// This is the one part of a card's markup that says what the card *is* rather
// than what it shows, and it is the mark a real results page puts on an
// advertisement: `data-ad-id` on the everything store's sponsored cards,
// `data-adid` on the auction marketplace's. It is also the one label a model
// can read on a page whose class names are hashed -- the attribute's own name,
// which the page's author wrote, and never a value read inside the item (D3).
//
// An attribute that marks some items and not others, or is written only as a
// yes or a no, is proposed as a `flag` mark (`../item-mark/`), so a flag
// written empty reads as a value and one written `"false"` as none.

import { isWithinSensitiveControl } from "../../sensitive-text";
import { isFlagAttribute } from "../item-mark";

/** How many of an item's own attributes become fields, so a container dense with data attributes cannot crowd out its values. */
const MAX_ITEM_ATTRIBUTES = 8;

/** A `data-*` attribute a field can name as written. `data-` alone names nothing, and a name a selector could not hold is not named. */
const ITEM_ATTRIBUTE = /^data-[A-Za-z][\w-]*$/u;

/**
 * The attributes that name an element rather than say anything about it.
 *
 * A test id is how detection already names elements -- it is the label and
 * the selector (`testIdName` in `../infer-fields.ts`) -- so reading it again as
 * a column would add a column of the item's own name to every record. It also
 * has a worse effect than clutter: a run of nothing but a password is refused
 * `sensitive_region` because it has no readable field (D12), and a test id
 * proposed as a column would give it one, so the row would be proposed with
 * the secret's column excluded and its id read instead.
 */
const IDENTITY_ATTRIBUTES: ReadonlySet<string> = new Set(["data-testid", "data-test", "data-cy"]);

/** One item attribute column, in the shape `../infer-fields.ts` measures every source in. */
export type ItemAttributeSource = { kind: "attribute"; label: string; attribute: string; sensitive: boolean; mark?: "flag" | undefined };

/** The item's own `data-*` attributes, at most `MAX_ITEM_ATTRIBUTES`, each a flag where the run makes it one. */
export function itemAttributeSources(item: Element, run: readonly Element[]): ItemAttributeSource[] {
  const sensitive = isWithinSensitiveControl(item);
  return Array.from(item.attributes)
    .filter((attribute) => ITEM_ATTRIBUTE.test(attribute.name) && !IDENTITY_ATTRIBUTES.has(attribute.name))
    .slice(0, MAX_ITEM_ATTRIBUTES)
    .map((attribute) => ({
      kind: "attribute" as const,
      label: attribute.name,
      attribute: attribute.name,
      sensitive,
      ...(!sensitive && isFlagAttribute(run, attribute.name) ? { mark: "flag" as const } : {})
    }));
}
