import { escapeHtml } from "../../../html.js";
import { SITE_ROOT } from "../catalog/index.js";
import type { SearchResults } from "../search/index.js";
import type { BigboxClasses } from "../theme/index.js";

/**
 * The filter sidebar. Each option is a checkbox whose value is the
 * `group:value` pair the URL carries; ticking one reloads the results. The
 * counts are the query's, taken before any filter, and never move.
 */
export function resultsSidebarMarkup(results: SearchResults, c: BigboxClasses): string {
  const groups = results.facets.map(({ group, options }) => `<fieldset class="${c.facetGroup}"><legend class="${c.facetLegend}">${escapeHtml(group.legend)}</legend>${options.map((option) => `<label class="${c.facetOption}"><input type="checkbox" value="${escapeHtml(`${group.key}:${option.value}`)}"${option.checked ? " checked" : ""}> ${escapeHtml(option.value)} <span class="${c.facetCount}">(${option.count})</span></label>`).join("")}</fieldset>`).join("");
  const clear = results.state.facets.length > 0 ? `<a class="${c.clearAll}" href="${SITE_ROOT}search?q=${encodeURIComponent(results.state.q)}">Clear all</a>` : "";
  return `<aside class="${c.sidebar}"><h2>Filters</h2>${clear}${groups}</aside>`;
}
