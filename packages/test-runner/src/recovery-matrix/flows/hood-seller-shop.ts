// Matrix case 14: a press the page never answered is not a success (t968).
//
// auction-marketplace's bot check, "Checking your browser before you
// continue", lets the visitor on by itself five seconds after it loads
// (`apps/scenario-lab/src/scenarios/auction-marketplace/client/challenge-script.ts`).
// Under the `browser-check-first` variant it stands in front of the very first
// results page, so the search below lands on it. In `run-mwohvt8n-a57cad8a`
// the same Flow's search was answered as text entered without its landing being
// read, the hood click was sent to the check page, the check's own timer took
// the tab on to the results while the click still looked for its target, and
// the lost reply was reported as a click that navigated: the next step looked
// for the seller's link on the results page four times and the run stopped.
//
// What the case requires instead (`../checks/matrix-checks.ts`, `act-effect-honest`):
// a click the page went away from before it pressed is refused as never made
// (`runtime/act-mark/`, `web.page.changed`, unacted) and made again on the page
// the tab went to; a click sent while the check stands finds no target and is
// retried until the check has let the visitor on. Either way the run reaches the
// shop and reads it with no model call, and no step answers success for a page
// it never changed.
//
// Targets are the page as the browser renders it; classes move with the seed:
// - the header search box by its form's role and its name;
// - the hood's own result, `li[data-listingid]` with the listing's number,
//   and the link that holds its heading (as the workflow's recording does);
// - the seller's link on the listing, which opens the shop in a tab of its own
//   that the run then drives (`runtime/click-landing.ts`);
// - the shop's items, `main > ul > li`, each a title link and a price.

export const HOOD_SELLER_SHOP = String.raw`flow: Find the Kestrel 35 lens hood's seller and read their shop
step: search for the lens hood
  node: web.dom.type
  selector: form[role="search"] input[name="_nkw"]
  element.tagName: input
  element.attributes: {"name": "_nkw"}
  text: kestrel 35 lens hood
  submit: true
  consequences: none
step: open the hood's listing
  node: web.dom.click
  selector: li[data-listingid="176623309961"] a:has([role="heading"])
  element.tagName: a
  timeoutMs: 8000
  consequences: none
step: open the seller's shop
  node: web.dom.click
  selector: a[href$="/str/the_camera_loft"]
  element.tagName: a
  timeoutMs: 8000
  consequences: none
step shop: read the seller's shop
  node: web.dom.extract_list
  extractList.item: main > ul > li
  extractList.fields: {"title": ":scope > a", "price": ":scope > span"}
  extractList.minItems: 1`;
