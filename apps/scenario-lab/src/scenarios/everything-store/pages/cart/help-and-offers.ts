import { HOUSEHOLD } from "../../catalog/index.js";
import type { PageKit } from "../page-kit.js";

/** The delivery questions, in the order the list shows them; the last is the one the pinned bar covers. */
const QUESTIONS: ReadonlyArray<readonly [string, string]> = [
  ["When will my order arrive?", "Your delivery date is shown at checkout and in Your Orders once the order ships."],
  ["Can I change my delivery address?", "You can change the address in Your Orders until the order is dispatched."],
  ["What is Brightaisle Day Delivery?", "Everything in one order arrives together on the day you choose, in fewer boxes."],
  ["Do you deliver on weekends?", "Saturday delivery is available in most areas at no extra cost."],
  ["Where is my package?", "Track it from Your Orders. Most packages update within a few hours of dispatch."],
  ["How do I cancel an order?", "Open Your Orders and choose Cancel items before the order is dispatched."],
];

function helpColumn(kit: PageKit): string {
  const { css } = kit;
  const questions = QUESTIONS.map(([question, answer]) => `<li><button type="button" class="${css.faqQuestion}" data-faq aria-expanded="false">${question}</button><p hidden>${answer}</p></li>`).join("");
  return `<div><h3>Help with this order</h3>
<p>Questions before you check out? <a href="#delivery-questions">Read our delivery questions</a></p>
<nav aria-label="Help topics" class="${css.helpTabs}"><a href="#help-delivery" data-help-tab>Delivery</a><a href="#help-returns" data-help-tab>Returns</a><a href="#help-gifts" data-help-tab>Gift options</a></nav>
<div id="help-delivery" data-help-panel><p>Orders placed by 2 pm ship the same day. Brightaisle Day Delivery groups your items into one trip.</p></div>
<div id="help-returns" data-help-panel hidden><p>Most items can be returned within 30 days of delivery for a full refund.</p></div>
<div id="help-gifts" data-help-panel hidden><p>Add a gift receipt and a personal message at checkout. Prices are hidden on the packing slip.</p></div>
<h3 id="delivery-questions">Delivery questions</h3>
<div class="${css.faqBox}"><ul class="${css.faqList}">${questions}</ul><p class="${css.faqBar}">Still need help? <a href="#contact-us">Contact us</a></p></div>
</div>`;
}

/**
 * A lightning deal on an item already in the cart: only a cart holding the
 * descaler shows one, and with it the page's only clocks.
 */
function lightningDeal(kit: PageKit): string {
  const { css } = kit;
  if (!kit.state.cart.some((line) => line.sku === HOUSEHOLD.descaler.sku)) return "";
  return `<h3>Lightning deal on an item in your cart</h3>
<p>Tidewell Kettle Descaler, 20% off. <span data-deal-clock>Ends in 14:59.9</span></p>
<p>Time left: <b data-deal-timer>14:59.9</b></p>
<p><a href="#claim-deal" class="${css.claimLink}" data-claim-deal>Claim deal</a></p>
`;
}

function offersColumn(kit: PageKit): string {
  const { css } = kit;
  return `<div>${lightningDeal(kit)}<h3>Deals for you</h3>
<p class="${css.helpTabs}"><a href="?dept=home" data-deal-filter>Home &amp; Kitchen</a><a href="?dept=electronics" data-deal-filter>Electronics</a><a href="?dept=office" data-deal-filter>Office</a></p>
<p data-deal-count>12 deals picked for you</p>
<p>Save $5 on your first Subscribe &amp; Save order. <a href="#promo-terms" data-promo-terms>See terms</a></p>
<section aria-labelledby="also-viewed" data-also-viewed><h3 id="also-viewed">Customers also viewed</h3>
<ul><li>Glass electric kettle, 1.7 L</li><li>Stainless steel tea infuser</li><li>Bamboo trivet, set of 2</li></ul>
<p><a href="?viewed=2" data-viewed-page>Page 2</a></p></section>
</div>`;
}

/**
 * The cart page's "Help and offers" area under `help-and-offers`. The cart
 * script answers its links (`client/help-and-offers-script.ts`); its fragment
 * ids are fixed, not seeded, because they are addresses.
 */
export function helpAndOffersMarkup(kit: PageKit): string {
  const { css } = kit;
  return `<section class="${css.fbt}" aria-labelledby="help-offers"><h2 id="help-offers">Help and offers</h2>
<div class="${css.helpOffers}">${helpColumn(kit)}${offersColumn(kit)}</div></section>`;
}
