import { escapeHtml } from "../../../html.js";
import { CONDITION_CODES, facetCounts, searchQueryString, type SearchParams } from "../catalog/index.js";
import { resultsPath, RESULTS_SUBPATH, MARKET_ROOT } from "../paths.js";
import type { AuctionState } from "../types.js";
import type { AuctionClasses } from "./styles.js";

function toggled(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

function checkboxLink(css: AuctionClasses, href: string, label: string, checked: boolean, count: number): string {
  return `<li><a class="${css.railLink}" role="checkbox" aria-checked="${checked}" href="${escapeHtml(href)}"><span>${escapeHtml(label)}</span> <span class="${css.railCount}">(${count})</span></a></li>`;
}

/**
 * The Condition filter. Its links carry one real bug: they are built from an
 * older URL helper that drops the buying-format parameter, so choosing a
 * condition quietly puts the results back on All listings. The tab above the
 * results says so, for anyone who looks.
 */
function conditionSection(css: AuctionClasses, params: SearchParams, state: AuctionState): string {
  const counts = facetCounts(params, state.bids, "conditions");
  const items = Object.entries(CONDITION_CODES).map(([code, label]) => {
    const next: SearchParams = { ...params, conditions: toggled(params.conditions, code), format: "all", page: 1 };
    return checkboxLink(css, resultsPath(searchQueryString(next)), label, params.conditions.includes(code), counts.get(code) ?? 0);
  }).join("");
  return `<section class="${css.railSection}" aria-label="Condition"><p class="${css.railHead}">Condition</p><ul class="${css.railList}">${items}</ul></section>`;
}

/**
 * An item-specifics filter, Model or Type. It reads what sellers typed into
 * the listing, which is sometimes wrong, and it starts collapsed unless one of
 * its values is chosen. Its header is a div that toggles on click.
 */
function specificSection(css: AuctionClasses, params: SearchParams, state: AuctionState, facet: "models" | "types", label: string): string {
  const counts = [...facetCounts(params, state.bids, facet).entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const chosen = params[facet];
  const items = counts.map(([value, count]) => {
    const next: SearchParams = { ...params, [facet]: toggled(chosen, value), page: 1 };
    return checkboxLink(css, resultsPath(searchQueryString(next)), value, chosen.includes(value), count);
  }).join("");
  const open = chosen.length > 0;
  return `<section class="${css.railSection}" aria-label="${label}"><div class="${css.railHead}" aria-expanded="${open}">${label}</div><ul class="${css.railList}"${open ? "" : " hidden"}>${items}</ul></section>`;
}

/** The price range: two boxes and a round arrow that is a div, not a button. Enter in either box submits the form too. */
function priceSection(css: AuctionClasses, params: SearchParams): string {
  const kept = new URLSearchParams(searchQueryString({ ...params, minPrice: null, maxPrice: null, page: 1 }));
  const hidden = [...kept.entries()].map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`).join("");
  const value = (pence: number | null) => (pence === null ? "" : String(pence / 100));
  return `<section class="${css.railSection}" aria-label="Price"><p class="${css.railHead}">Price</p>
<form class="${css.railPrice}" action="${MARKET_ROOT}${RESULTS_SUBPATH}" method="get">${hidden}
<input class="${css.railInput}" type="text" name="_udlo" value="${value(params.minPrice)}" placeholder="£ Min" aria-label="Minimum Value in £" inputmode="decimal">
<span>to</span>
<input class="${css.railInput}" type="text" name="_udhi" value="${value(params.maxPrice)}" placeholder="£ Max" aria-label="Maximum Value in £" inputmode="decimal">
<div class="${css.railGo}" title="Submit price range">&#8250;</div>
</form></section>`;
}

/** The filter rail down the left of the results. */
export function railMarkup(css: AuctionClasses, params: SearchParams, state: AuctionState): string {
  return `<aside class="${css.rail}" aria-label="Filters">
<section class="${css.railSection}" aria-label="Category"><p class="${css.railHead}">Category</p><ul class="${css.railList}"><li>Cameras &amp; Photography</li><li>Film Photography</li><li>Film Cameras</li></ul></section>
${conditionSection(css, params, state)}
${specificSection(css, params, state, "models", "Model")}
${specificSection(css, params, state, "types", "Type")}
${priceSection(css, params)}
<section class="${css.railSection}" aria-label="Item location"><p class="${css.railHead}">Item location</p><ul class="${css.railList}"><li>Default</li><li>UK only</li><li>European Union</li><li>Worldwide</li></ul></section>
</aside>`;
}
