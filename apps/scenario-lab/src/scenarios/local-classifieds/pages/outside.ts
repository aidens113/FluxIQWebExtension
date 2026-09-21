import { page } from "../../../html.js";
import type { Advert, Place } from "../catalog/index.js";
import { classifiedsStylesheet, advertShopMarkup, mapFrameBody } from "../view/index.js";
import type { PageBuild } from "./document.js";

/**
 * The advertiser's shop, opened in a new tab by a sponsored card. It is not
 * part of the marketplace: no sidebar, no cookie question, and a Buy now that
 * starts somebody else's checkout.
 */
export function advertPage(build: PageBuild, advert: Advert): string {
  const script = `
const buy = Array.from(document.querySelectorAll('[role="button"]')).find((node) => node.textContent.trim() === 'Buy now');
buy.addEventListener('click', () => { buy.textContent = 'Taking you to checkout…'; });`;
  return page(`${advert.title} | ${advert.advertiser}`, `${advertShopMarkup(build.sheet, advert)}<style>${classifiedsStylesheet(build.sheet.keys)}</style>`, script);
}

/** The embedded map's own document, served cross-origin into the listing page. */
export function mapPage(place: Place): string {
  return page(`Map of ${place.name}`, mapFrameBody(place), "");
}
