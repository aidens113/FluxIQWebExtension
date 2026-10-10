// Matrix row 8: a primary way to add the lemon dish soap to the cart and a
// known second way, each a part, checked the same way.
//
// The primary part opens the soap's own listing and presses the buy bar's
// Add to cart (`data-testid="atc"`). Under `redesigned-buy-box` that control
// lost its test id, so the part fails; the `fail` handler for the step that
// called it runs the second part instead -- search again and press the
// results tile's "+ Add", which the redesign left alone (a single-size product
// has a quick-add, `listing/tile.ts`) -- and stands in for the failed call's
// output with the second part's. Each part ends by reading the mini cart's
// summary line, so either way hands back the same thing.
//
// No selector here names a generated class: the redesign renames every class
// on the site. A tile is found by its `data-item-id`, an ad being the tile that
// opens with a `div`; the mini cart's summary by its own test id.
export const QUICK_ADD_ALTERNATIVE = String.raw`flow: Add the lemon dish soap to the cart, from its product page or from the results
step: accept the privacy choices if they are still asked
  node: web.dom.click
  selector: [role="dialog"][aria-modal="true"] button:first-of-type
  consequences: none
  optional: yes
step: decline the email offer if it shows
  node: web.dom.click
  selector: form + a[href="#"]
  timeoutMs: 8000
  consequences: none
  optional: yes
step: search for dish soap
  node: web.dom.type
  selector: input[type="search"]
  element.tagName: input
  element.attributes: {"type": "search", "name": "q"}
  text: dish soap
  submit: true
  consequences: none
step buy: add the soap from its product page
  call: product-page
on fail for buy: the product page has no Add to cart
  step other: add the soap from the results tile
    call: quick-add
  then: use cart = $step.other.cart
end
part product-page: add the soap from its own product page
  output: cart = $step.page-cart.records
  step: open the soap's own listing
    node: web.dom.click
    selector: div[data-item-id="418832007"]:not(:has(> div:first-child)) > a:first-of-type
    timeoutMs: 8000
    consequences: none
  step: add to cart
    node: web.dom.click
    selector: [data-testid="atc"]
    consequences: modify_existing
  step page-cart: read the mini cart's summary
    node: web.dom.extract_list
    extractList.item: [data-testid="mini-cart-summary"]
    extractList.fields: {"summary": {"kind": "text"}}
    extractList.minItems: 0
end
part quick-add: add the soap from the results tile
  output: cart = $step.tile-cart.records
  step: search for dish soap again
    node: web.dom.type
    selector: input[type="search"]
  element.tagName: input
  element.attributes: {"type": "search", "name": "q"}
    text: dish soap
    submit: true
    consequences: none
  step: press the soap tile's + Add
    node: web.dom.click
    selector: div[data-item-id="418832007"]:not(:has(> div:first-child)) > button
    timeoutMs: 8000
    consequences: modify_existing
  step tile-cart: read the mini cart's summary
    node: web.dom.extract_list
    extractList.item: [data-testid="mini-cart-summary"]
    extractList.fields: {"summary": {"kind": "text"}}
    extractList.minItems: 0
end`;
