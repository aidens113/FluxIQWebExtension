// Matrix row 1 (and the Flow rows 4, 5 and 11 run under their switches):
// crossborder-marketplace's hub-to-cart task as a candidate script.
//
// Every target is the site's own markup for the canonical seed (7342), read
// from `apps/scenario-lab/src/scenarios/crossborder-marketplace/markup/` the way
// the scenario's recording script reads it (`manifest/steps.ts`): the build's
// generated class names, a `title`, a link's address, the one test id the buy
// bar carries. Selectors stay literal: a hand-authored Flow has no exploration,
// so it names no evidence handle. A typing step also says which field it is
// (`element`): with none, Core reads the text typed as the field's identity and
// the browser refuses the right field as a mismatch (`web.target.ambiguous`,
// matrix run 2 of case 1).
//
// The welcome, consent and chat steps are `optional`: the extension's own interference
// clearing may answer the consent banner while an earlier step waits for its
// target, and then there is no "Accept all" left to press. Matrix run 1 of
// case 1 failed `web.target.not_found` on the step after the first, four
// attempts; its trace was not kept, so the banner being gone is the reading
// the attempt counts allow, not one the trace showed.
//
// - `css-033dshf > css-0tkka45`: the welcome modal's ghost button, "No thanks".
// - `css-0rslz0n > css-15iz7xc`: the consent banner's primary button, "Accept all".
// - The official listing's title link (`css-1hm54fa` is the card title), which
//   opens the listing in a new tab; the next step switches to it.
// - `css-1kc7ej3`: the chat pill over the buy bar, minimised by its `title`.
// - `css-15cl3ai`: a colour swatch, named only by its `title`.
// - The option groups are the item column's fourth and fifth `div`s
//   (`css-1ksxmtl`): specification 4-in-1 / 7-in-1 / 10-in-1 and ships-from
//   China / Spain / Poland; each choice is set, not pressed, so a run that finds
//   it already chosen leaves it chosen.
// - `css-1vwwh2u`: the quantity box.
// - The store coupon is a web component (`fb-store-coupon`) whose button is
//   `.b` in its shadow root. Its first claim of a visit always answers "Network
//   busy"; the extension reports that as a busy refusal and the node's own
//   retry claims it again.
export const HUB_TO_CART = String.raw`flow: Put three Voltbay USB-C hubs, Space Grey, 7-in-1, shipped from Spain, in the cart with the store's coupon
step: decline the welcome coupons if they are still offered
  node: web.dom.click
  selector: .css-033dshf > .css-0tkka45
  timeoutMs: 10000
  consequences: none
  optional: yes
step: accept the cookies if they are still asked
  node: web.dom.click
  selector: .css-0rslz0n > .css-15iz7xc
  consequences: none
  optional: yes
step: search for usb c hub
  node: web.dom.type
  selector: input[name="q"]
  element.tagName: input
  element.attributes: {"name": "q"}
  text: usb c hub
  submit: true
  consequences: none
step: open the official store's listing
  node: web.dom.click
  selector: a[href="/scenarios/crossborder-marketplace/item/1005008123450"]:has(.css-1hm54fa)
  timeoutMs: 8000
  consequences: none
step: go to the listing's tab
  node: web.browser.tab
  tab.operation: switch
  tab.urlPath: /scenarios/crossborder-marketplace/item/1005008123450
step: minimise the store chat if it shows
  node: web.dom.click
  selector: .css-1kc7ej3 > [title="Minimize chat"]
  timeoutMs: 8000
  consequences: none
  optional: yes
step: keep Space Grey chosen
  node: web.dom.check
  selector: .css-15cl3ai[title="Space Grey"]
  checked: true
step: choose 7-in-1
  node: web.dom.check
  selector: .css-1ksxmtl > div:nth-of-type(4) .css-1354e7d:nth-child(2)
  checked: true
step: choose shipping from Spain
  node: web.dom.check
  selector: .css-1ksxmtl > div:nth-of-type(5) .css-1354e7d:nth-child(2)
  checked: true
step: set the quantity to three
  node: web.dom.type
  selector: .css-1vwwh2u
  element.tagName: input
  element.attributes: {"inputmode": "numeric"}
  text: 3
step: collect the store's coupon
  node: web.dom.click
  selector: .b
  element.context.shadowHosts: ["fb-store-coupon"]
  consequences: modify_existing
step: add to cart
  node: web.dom.click
  selector: [data-testid="add-to-cart"]
  consequences: modify_existing`;
