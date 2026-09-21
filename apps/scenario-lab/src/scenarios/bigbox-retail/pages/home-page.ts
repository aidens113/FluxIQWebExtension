import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { findProduct, SITE_ROOT, storeById } from "../catalog/index.js";
import type { BigboxState, Product } from "../types.js";
import { renderShell } from "../shell/index.js";
import { listingMarkup, tileDefaultsFor } from "../listing/index.js";
import type { BigboxClasses } from "../theme/index.js";

const SLIDES = [
  { heading: "Rollbacks on household essentials", text: "Paper towels, napkins and more, for less.", href: `${SITE_ROOT}search?q=paper+towels&facet=special_offers%3ARollback`, color: "#0b4f4a", cta: "Shop Rollbacks" },
  { heading: "Pickup today, free on orders over $35", text: "Order by 6pm and pick it up tonight.", href: `${SITE_ROOT}search?q=paper+towels`, color: "#7a3b00", cta: "Shop pickup" },
  { heading: "Back-to-school lunch packing", text: "Napkins, wraps and snacks in bulk.", href: `${SITE_ROOT}search?q=napkins`, color: "#2c2c6b", cta: "Shop now" },
];
const PICKUP_TODAY = ["402917554", "417553117", "418831402", "418832007", "418830190", "417553090", "433201844", "433201899"];
const ROLLBACKS = ["417553090", "433201844", "402918013", "433202210"];

const rail = (title: string, products: readonly Product[], state: BigboxState, c: BigboxClasses, more: string) =>
  `<section class="${c.rail}"><div class="${c.railHead}"><h2>${escapeHtml(title)}</h2><a href="${escapeHtml(more)}">View all</a></div><ul class="${c.railList}">${products.map((product) => listingMarkup(product, state.storeId, c, "rail")).join("")}</ul></section>`;

/**
 * The storefront: a hero that rotates on its own every few seconds, so the
 * button under a pointer changes while it rests there, and two rails of
 * quick-add listings. Nothing on it is needed for any workflow; everything on
 * it is somewhere a click can land by mistake.
 */
export function renderHomePage(state: BigboxState, context: RenderContext): string {
  const pickup = PICKUP_TODAY.map((id) => findProduct(id)!.product);
  const rollbacks = ROLLBACKS.map((id) => findProduct(id)!.product);
  return renderShell({
    state, context, kind: "home", title: "Save Money. Live Better.",
    tileDefaults: tileDefaultsFor([...pickup, ...rollbacks], state.storeId),
    main: (c) => `<section class="${c.hero}" aria-roledescription="carousel">${SLIDES.map((slide, index) => `<div class="${c.heroSlide}" style="background:${slide.color}"${index === 0 ? "" : " hidden"}><h1>${escapeHtml(slide.heading)}</h1><p>${escapeHtml(slide.text)}</p><a class="${c.btn} ${c.btnSecondary}" href="${escapeHtml(slide.href)}">${escapeHtml(slide.cta)}</a></div>`).join("")}<div class="${c.heroDots}">${SLIDES.map(() => `<span class="${c.heroDot}"></span>`).join("")}</div></section>
${rail(`Pickup today at ${storeById(state.storeId).name}`, pickup, state, c, `${SITE_ROOT}search?q=paper+towels`)}
${rail("Rollbacks", rollbacks, state, c, `${SITE_ROOT}search?q=paper+towels&facet=special_offers%3ARollback`)}`,
    script: (c) => `{
  const slides = document.querySelectorAll('.${c.heroSlide}'); let shown = 0;
  setInterval(() => { slides[shown].hidden = true; shown = (shown + 1) % slides.length; slides[shown].hidden = false; }, 4000);
}`,
  });
}
