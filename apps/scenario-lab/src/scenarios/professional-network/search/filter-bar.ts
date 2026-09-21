import { escapeHtml } from "../../../html.js";
import { DEFAULT_GEO_IDS, geoById, MEMBERS } from "../data/index.js";
import type { ShellKit } from "../shell/index.js";
import type { PeopleQuery } from "./query.js";
import { companySlug } from "./results.js";

type Facet = { name: "network" | "geoUrn" | "currentCompany"; label: string; options: Array<{ value: string; label: string }>; typeahead?: string };

/** One dropdown's ids, for the page script. `list` is where a typed-ahead choice is added. */
export type FacetIds = { pill: string; panel: string; list: string; cancel: string; apply: string; input?: string; suggestions?: string; facet: Facet["name"] };
export type FilterBarIds = { facets: FacetIds[]; allPill: string; allScrim: string; allApply: string; allCancel: string; allLists: Record<Facet["name"], string>; reset: string; typePill: string };

const DEFAULT_COMPANIES = ["Harbourline Logistics", "Kade Energy", "Veldhuis Bank", "Northsea Freight", "Portwise"];

/** Every company a member works at, for the company typeahead. */
export function companyOptions(): Array<{ value: string; label: string }> {
  return [...new Set(MEMBERS.map((member) => member.company).filter(Boolean))].sort().map((company) => ({ value: companySlug(company), label: company }));
}

function facets(query: PeopleQuery): Facet[] {
  const geos = [...new Set([...query.geo, ...DEFAULT_GEO_IDS])].flatMap((id) => { const place = geoById(id); return place ? [{ value: place.id, label: place.label }] : []; });
  const companies = [...new Set([...query.company, ...DEFAULT_COMPANIES.map(companySlug)])].flatMap((slug) => companyOptions().filter((option) => option.value === slug));
  return [
    { name: "network", label: "Connections", options: [{ value: "F", label: "1st" }, { value: "S", label: "2nd" }, { value: "O", label: "3rd+" }] },
    { name: "geoUrn", label: "Locations", options: geos, typeahead: "Add a location" },
    { name: "currentCompany", label: "Current company", options: companies, typeahead: "Add a company" },
  ];
}

function chosen(query: PeopleQuery, name: Facet["name"]): readonly string[] {
  return name === "network" ? query.network : name === "geoUrn" ? query.geo : query.company;
}

function checkRows(kit: ShellKit, facet: Facet, query: PeopleQuery): string {
  const c = kit.css;
  const selected = chosen(query, facet.name);
  return facet.options.map((option) => {
    const id = kit.ids.next();
    return `<div class="${c.checkRow}"><input id="${id}" type="checkbox" name="${facet.name}" value="${escapeHtml(option.value)}"${selected.includes(option.value) ? " checked" : ""}><label for="${id}">${escapeHtml(option.label)}</label></div>`;
  }).join("");
}

/**
 * The filter bar over the people results. Each filter is a pill -- a styled
 * block with a tab stop and a click handler, not a button -- over a dropdown
 * of checkboxes whose "Show results" and "Cancel" are styled blocks too. The
 * locations dropdown offers five places, neither Rotterdam among them, and a
 * typeahead for the rest. "All filters" opens the same three groups again in
 * a panel of its own, so every checkbox label on the page exists twice.
 */
export function filterBar(kit: ShellKit, query: PeopleQuery): { markup: string; allFilters: string; ids: FilterBarIds } {
  const c = kit.css;
  const next = kit.ids.next;
  const typePill = next();
  const groups = facets(query);
  const facetIds: FacetIds[] = [];
  const pills = groups.map((facet) => {
    const ids: FacetIds = { pill: next(), panel: next(), list: next(), cancel: next(), apply: next(), facet: facet.name };
    const on = chosen(query, facet.name).length > 0;
    let typeahead = "";
    if (facet.typeahead) {
      ids.input = next();
      ids.suggestions = next();
      typeahead = `<div class="${c.typeahead}"><input id="${ids.input}" type="text" placeholder="${facet.typeahead}" autocomplete="off" style="width:100%;height:32px;border:1px solid #666;border-radius:4px;padding:0 8px"><div id="${ids.suggestions}"></div></div>`;
    }
    facetIds.push(ids);
    return `<div style="position:relative"><div id="${ids.pill}" class="${c.pill}${on ? ` ${c.pillOn}` : ""}" tabindex="0">${facet.label} ▾</div>
<div id="${ids.panel}" class="${c.dropdown}" hidden>${typeahead}<div id="${ids.list}" style="padding:8px 0;max-height:260px;overflow:auto">${checkRows(kit, facet, query)}</div>
<div class="${c.dropdownFoot}"><div id="${ids.cancel}" class="${c.textBtn}">Cancel</div><div id="${ids.apply}" class="${c.primaryBtn}">Show results</div></div></div></div>`;
  }).join("");
  const allPill = next();
  const allScrim = next();
  const allApply = next();
  const allCancel = next();
  const reset = next();
  const allLists = {} as Record<Facet["name"], string>;
  const allGroups = groups.map((facet) => {
    allLists[facet.name] = next();
    return `<fieldset style="border:0;border-bottom:1px solid #e0dfdc;margin:0;padding:12px 0"><legend style="font-weight:600;font-size:16px">${facet.label}</legend><div id="${allLists[facet.name]}">${checkRows(kit, facet, query)}</div></fieldset>`;
  }).join("");
  const markup = `<div class="${c.pillBar}"><div id="${typePill}" class="${c.pill} ${c.pillOn}" tabindex="0">People ▾</div>${pills}
<div id="${allPill}" class="${c.pill}" tabindex="0">All filters</div><div id="${reset}" class="${c.textBtn}">Reset</div></div>`;
  const allFilters = `<div id="${allScrim}" class="${c.scrim}" hidden><div class="${c.modal}" role="dialog" aria-modal="true" aria-label="All filters">
<div class="${c.modalHead}"><h2>Filter only People by</h2></div><div class="${c.modalBody}" style="max-height:60vh;overflow:auto">${allGroups}</div>
<div class="${c.modalFoot}"><div id="${allCancel}" class="${c.textBtn}">Cancel</div><div id="${allApply}" class="${c.primaryBtn}">Show results</div></div></div></div>`;
  return { markup, allFilters, ids: { facets: facetIds, allPill, allScrim, allApply, allCancel, allLists, reset, typePill } };
}
