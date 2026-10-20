import { PARTNER_WIDGETS } from "../pages/partner-widgets/index.js";

/**
 * The partner embeds in the browser, run after the product page's own script:
 *
 * - The pay-over-time offer is defined at load. Its element attaches a closed
 *   root holding the offer and hidden details, and exposes `toggleDetails`,
 *   which the details link beside it calls: the details open inside the root
 *   and nothing outside it changes.
 * - The delivery estimate is defined at load, but the element is created only
 *   when its link is pressed, a moment later, with its text already inside
 *   its open root, and then inserted after the link. A second press adds no
 *   second estimate.
 * - The review highlights element is in the page from load, undefined. Its
 *   link defines it a moment later; the upgrade attaches the open root and
 *   its text to the element already in place, which no observer of the
 *   page's own nodes sees.
 */
export function partnerWidgetsScript(): string {
  return `{
const W = ${JSON.stringify(PARTNER_WIDGETS)};
const offerHost = document.querySelector(W.payOverTime.tag);
const strip = offerHost.parentElement.parentElement;
const [payLink, deliveryLink, highlightsLink] = strip.querySelectorAll('a');
const line = (text) => {
  const node = document.createElement('p');
  node.style.margin = '4px 0 0';
  node.textContent = text;
  return node;
};
customElements.define(W.payOverTime.tag, class extends HTMLElement {
  #details;
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'closed' });
    const offer = document.createElement('span');
    offer.textContent = W.payOverTime.offer;
    this.#details = line(W.payOverTime.details);
    this.#details.hidden = true;
    root.append(offer, this.#details);
  }
  toggleDetails() { this.#details.hidden = !this.#details.hidden; }
});
payLink.addEventListener('click', (event) => {
  event.preventDefault();
  offerHost.toggleDetails();
});
customElements.define(W.deliveryEstimate.tag, class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).append(line(W.deliveryEstimate.text));
  }
});
let estimating = false;
deliveryLink.addEventListener('click', (event) => {
  event.preventDefault();
  if (estimating) return;
  estimating = true;
  setTimeout(() => deliveryLink.parentElement.append(document.createElement(W.deliveryEstimate.tag)), W.answerDelayMs);
});
highlightsLink.addEventListener('click', (event) => {
  event.preventDefault();
  if (customElements.get(W.reviewHighlights.tag)) return;
  setTimeout(() => {
    if (customElements.get(W.reviewHighlights.tag)) return;
    customElements.define(W.reviewHighlights.tag, class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' }).append(line(W.reviewHighlights.text));
      }
    });
  }, W.answerDelayMs);
});
}`;
}
