// Matrix row 6: a handler on the first step and one for the whole automation,
// both matching the promotion that stands over the home page on arrival
// (`flash-deal-on-arrival`). The step's handler is written first (`h1`) and
// must be the one that runs for that occurrence; the trace says which ran.
//
// **Authoring gap**, as in `promotion-handler.ts`: the promotion
// can be named in a fact only by an evidence handle, so `flash-deal-close` is a
// placeholder and the runner refuses the Flow.
import { HUB_TO_CART } from "./cart.js";

export const HUB_TO_CART_TWO_HANDLERS = `${HUB_TO_CART.replace("step: decline the welcome coupons if they are still offered", "step welcome: decline the welcome coupons if they are still offered")}
on before for welcome: the promotion covers the welcome coupons
  when: visible flash-deal-close
  step: close the promotion over the welcome coupons
    node: web.dom.click
    selector: .css-1ohale1 > [title="Close"]
    consequences: none
  then: carry on
end
on before everywhere: the flash-sale promotion can stand over any page
  when: visible flash-deal-close
  step: close the promotion
    node: web.dom.click
    selector: .css-1ohale1 > [title="Close"]
    consequences: none
  then: carry on
end`;
