// Matrix row 6: a handler on the first step and one for the whole automation,
// both matching the promotion that stands over the home page on arrival
// (`flash-deal-on-arrival`). The step's handler is written first (`h1`) and
// must be the one that runs for that occurrence; the trace says which ran.
//
// The promotion is named in each fact by a locator, as in
// `promotion-handler.ts`.
import { HUB_TO_CART } from "./cart.js";

export const HUB_TO_CART_TWO_HANDLERS = `${HUB_TO_CART.replace("step: decline the welcome coupons if they are still offered", "step welcome: decline the welcome coupons if they are still offered")}
on before for welcome: the promotion covers the welcome coupons
  when: visible at ".css-1ohale1 > [title='Close']"
  step: close the promotion over the welcome coupons
    node: web.dom.click
    selector: .css-1ohale1 > [title="Close"]
    consequences: none
  then: carry on
end
on before everywhere: the flash-sale promotion can stand over any page
  when: visible at ".css-1ohale1 > [title='Close']"
  step: close the promotion
    node: web.dom.click
    selector: .css-1ohale1 > [title="Close"]
    consequences: none
  then: carry on
end`;
