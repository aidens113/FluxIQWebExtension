import { escapeHtml } from "../../../html.js";
import { CONDITION_PARAMS, listingConditions, SORT_OPTIONS, type FeedQuery } from "../catalog/index.js";
import { conditionLabel } from "../format/index.js";
import type { ClassSheet, IdName } from "./classes.js";

/**
 * The results page's filters, as they sit in the sidebar under "Filters".
 *
 * Nothing here is a native control that says what it is at a glance. Sort is
 * a scripted combobox that opens a list of options. Price is two bare boxes
 * whose only name is their placeholder, and they apply on Enter or when focus
 * leaves them. Condition, date, availability and delivery each sit folded
 * behind a heading that has to be opened first. The location and radius live
 * in a web component with its own shadow root, above all of it.
 */
export function filtersMarkup(sheet: ClassSheet, ids: Record<IdName, string>, query: FeedQuery): string {
  const c = sheet.names;
  const sortLabel = SORT_OPTIONS.find((option) => option.value === query.sort)?.label ?? "Suggested";
  const conditions = listingConditions.map((condition) =>
    `<label class="${c.choiceRow}"><input type="checkbox" value="${CONDITION_PARAMS[condition]}"${query.conditions.includes(condition) ? " checked" : ""}> ${escapeHtml(conditionLabel(condition))}</label>`).join("");
  const radios = (group: string, options: ReadonlyArray<readonly [string, string]>, current: string) => options.map(([value, label]) =>
    `<label class="${c.choiceRow}"><input type="radio" name="${group}" value="${value}"${value === current ? " checked" : ""}> ${escapeHtml(label)}</label>`).join("");
  const folded = (panel: IdName, title: string, open: boolean, body: string) => `<div class="${c.filterBlock}">
    <div class="${c.filterToggle}" role="button" tabindex="0" aria-expanded="${open}" aria-controls="${ids[panel]}"><span>${title}</span><span aria-hidden="true">&#9662;</span></div>
    <div class="${c.filterPanel}" id="${ids[panel]}"${open ? "" : " hidden"}>${body}</div>
  </div>`;
  return `<div class="${c.sideSection}">
  <h2 class="${c.sideHeading}">Filters</h2>
  <div class="${c.filterBlock}"><kf-location place="Kelford" radius="${query.radius}"></kf-location></div>
  <div class="${c.filterBlock}">
    <span class="${c.filterLabel}" id="${ids.sortLabel}">Sort by</span>
    <div class="${c.combobox}" role="combobox" tabindex="0" aria-haspopup="listbox" aria-expanded="false" aria-controls="${ids.sortList}" aria-labelledby="${ids.sortLabel}">${escapeHtml(sortLabel)}</div>
  </div>
  <div class="${c.filterBlock}">
    <span class="${c.filterLabel}">Price</span>
    <div class="${c.priceRow}"><input class="${c.priceInput}" inputmode="numeric" placeholder="Min" autocomplete="off" value="${query.minPrice ?? ""}"><span>to</span><input class="${c.priceInput}" inputmode="numeric" placeholder="Max" autocomplete="off" value="${query.maxPrice ?? ""}"></div>
  </div>
  ${folded("conditionPanel", "Item condition", query.conditions.length > 0, conditions)}
  ${folded("datePanel", "Date listed", query.days !== null, radios(ids.dateGroup, [["", "All"], ["1", "Last 24 hours"], ["7", "Last 7 days"], ["30", "Last 30 days"]], query.days === null ? "" : String(query.days)))}
  ${folded("availabilityPanel", "Availability", query.availability !== "available", radios(ids.availabilityGroup, [["available", "Available"], ["sold", "Sold"]], query.availability))}
  ${folded("deliveryPanel", "Delivery method", query.delivery !== "all", radios(ids.deliveryGroup, [["all", "All"], ["local_pick_up", "Local pickup"], ["shipping", "Shipping"]], query.delivery))}
</div>`;
}
