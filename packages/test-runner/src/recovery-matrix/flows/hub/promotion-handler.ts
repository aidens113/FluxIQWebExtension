// Matrix rows 4 and 5: the hub-to-cart Flow with one handler for the store's
// flash-sale promotion, which can stand over any page (`flash-deal-on-arrival`
// over the home page before the first action, `flash-deal` over the product
// page midway, `flash-deal-stuck` with a close glyph that does nothing).
//
// One rule for every place, as the state-aware format teaches: `on before
// everywhere`, closing the promotion by its close glyph (`css-1ohale1` is the
// flash-sale modal's own class for seed 7342, `flashModal`; the welcome modal
// shares only the generic `modal` class, `title="Close"` is the glyph) and
// carrying on with the step it stood in front of. Its completion check is the
// opposite of its `when:`.
//
// The promotion has no role and no accessible name (`markup/overlays.ts`), so
// the only fact that can say it is showing is one about its element, named by
// a locator (`at "<css>"`, t402): a hand-authored Flow has no evidence handle.
// A locator sits inside the line's double quotes, so its own quotes are single.
import { HUB_TO_CART } from "./cart.js";

export const HUB_TO_CART_PROMOTION_HANDLER = `${HUB_TO_CART}
on before everywhere: the flash-sale promotion can stand over any page
  when: visible at ".css-1ohale1 > [title='Close']"
  step: close the promotion
    node: web.dom.click
    selector: .css-1ohale1 > [title="Close"]
    consequences: none
  then: carry on
end`;
