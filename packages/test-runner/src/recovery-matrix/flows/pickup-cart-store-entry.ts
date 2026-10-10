// Matrix row 2: bigbox-retail's pickup cart, with an entry past the store
// choice for a run that finds the store already chosen (`store-remembered`).
//
// The default path answers the consent dialog, declines the email offer if it
// shows, opens the store picker and sets Millbrook Crossing Supercenter, then
// searches, opens the towels' own listing (not an ad for it), chooses the 12
// Double Rolls size, makes it two packs, closes the assistant's card if it
// shows, and adds to cart. The `search` entry lets a run begin at the search
// when the header's store chip already names Millbrook; the search text is a
// Flow input, so the entry's `requires` names it and a run without it cannot
// take the entry with it unbound.
//
// Targets are the site's markup for the canonical seed (239), from
// `apps/scenario-lab/src/scenarios/bigbox-retail/`: the consent dialog's first
// button; the offer's decline link, which follows its form; the picker's chip
// and Millbrook's card (the third) inside `vr-fulfillment-picker`'s shadow
// root; a tile by its `data-item-id`, an ad being the tile that opens with a
// `div`; the size swatches (`css-00w0dw0`, the second is 12 Double Rolls); the
// quantity stepper's `+` (`css-04djnkh > css-0sc4qxh`); the assistant card's
// close glyph (`css-1ywuhio > css-0kpe9hw`) inside `vr-assist`; and the buy
// bar's `data-testid="atc"`.
//
// **Authoring gap.** The entry's condition is a fact about the store chip,
// which the candidate grammar can name only by an evidence handle;
// `store-chip` is a placeholder for it, and the runner refuses the Flow.
export const PICKUP_CART_STORE_ENTRY = String.raw`flow: Put two packs of the 12 Double Rolls Select-A-Size paper towels in a pickup cart at Millbrook Crossing Supercenter
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
step: open the store picker
  node: web.dom.click
  selector: button:first-of-type
  element.context.shadowHosts: ["vr-fulfillment-picker"]
  consequences: none
step: set Millbrook Crossing Supercenter as my store
  node: web.dom.click
  selector: li:nth-child(3) button
  element.context.shadowHosts: ["vr-fulfillment-picker"]
  consequences: modify_existing
start at: search
when: text store-chip contains "Millbrook Crossing Supercenter"
step search: search for the paper towels
  node: web.dom.type
  selector: input[type="search"]
  element.tagName: input
  element.attributes: {"type": "search", "name": "q"}
  text: $input.query = select-a-size paper towels
  submit: true
  consequences: none
step: open the towels' own listing
  node: web.dom.click
  selector: div[data-item-id="418830127"]:not(:has(> div:first-child)) > a:first-of-type
  timeoutMs: 8000
  consequences: none
step: choose 12 Double Rolls
  node: web.dom.check
  selector: .css-00w0dw0:nth-child(2)
  checked: true
step: make it two packs
  node: web.dom.click
  selector: .css-04djnkh > .css-0sc4qxh:last-child
  consequences: none
step: close the assistant's card if it shows
  node: web.dom.click
  selector: .css-1ywuhio > .css-0kpe9hw
  element.context.shadowHosts: ["vr-assist"]
  timeoutMs: 8000
  consequences: none
  optional: yes
step: add to cart
  node: web.dom.click
  selector: [data-testid="atc"]
  consequences: modify_existing`;
