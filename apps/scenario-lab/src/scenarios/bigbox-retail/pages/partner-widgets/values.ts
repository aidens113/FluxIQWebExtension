import { SITE_ROOT } from "../../catalog/index.js";

/**
 * The three partner embeds the `partner-widgets` rendering switches on in the
 * product page's buy box, as a store ships them from other companies, all
 * fictional: a pay-over-time offer that draws itself inside a closed shadow
 * root, a delivery estimate that is inserted with its text already inside its
 * open root, and review highlights whose element sits in the page from the
 * start and is upgraded, attaching its root, only when asked for.
 *
 * Exported so the browser tests find each tag, link and line here rather than
 * restating them.
 */
export const PARTNER_WIDGETS = {
  /** The offer: its host is defined at load and attaches a closed root; the link beside it opens the details inside that root. */
  payOverTime: {
    tag: "quartera-offer",
    link: "See payment plan details",
    href: "#pay-over-time",
    offer: "Pay in 4 interest-free installments with Quartera",
    details: "No fees when you pay on time. Subject to approval.",
  },
  /** The estimate: its link inserts the element a moment later, its root and text already inside it. */
  deliveryEstimate: {
    tag: "parcelwise-estimate",
    link: "Estimate delivery to your area",
    href: `${SITE_ROOT}help/delivery-estimate`,
    text: "Delivered from your store as soon as tomorrow, free on orders over $35",
  },
  /** The highlights: the element is in place from load, undefined; its link defines it a moment later, which attaches its root. */
  reviewHighlights: {
    tag: "reviewloom-highlights",
    link: "Read review highlights",
    href: `${SITE_ROOT}help/review-highlights`,
    text: "Shoppers often mention: good value, easy pickup, sturdy packaging",
  },
  /** How long the estimate and the highlights take to answer their link, in milliseconds. */
  answerDelayMs: 150,
} as const;
