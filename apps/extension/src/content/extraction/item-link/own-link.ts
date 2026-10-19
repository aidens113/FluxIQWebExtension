// Whether a run's item is itself a link, whose address is then one of its
// columns.
//
// **Until 2026-10-19 that address was never a column.** Inference offered the
// item's own `data-*` attributes and what its descendants hold, and a link only
// as a descendant `<a href>`. On a grid whose every tile *is* the `<a href>` --
// an image and a count inside it -- no column held the tile's address, so a
// read asked for each item's link could not give it (live run
// `run-mvecxeci-1c2cc227`, step 0017). Such an item now offers a `link` field
// with no selector, which the list reader reads off the item itself and makes
// absolute exactly as it makes every link column absolute (`../field-reader.ts`,
// `linkTarget`): nothing here reads or resolves the address, so the proposal
// never carries a value read inside an item (D3).

/** Whether the item is an HTML link carrying an `href`, so its own address is a column. */
export function offersOwnLink(item: Element): boolean {
  return item.tagName.toLowerCase() === "a" && item.getAttribute("href") !== null;
}
