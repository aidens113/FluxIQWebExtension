import { geoById, MEMBERS, memberNamed } from "../data/index.js";
import type { Member } from "../types.js";
import type { PeopleQuery } from "./query.js";

export const PEOPLE_PAGE_SIZE = 10;

/**
 * One entry of a results page. `organic` entries are what the search found;
 * `promoted` is a member's profile an advertiser paid to place, carrying the
 * same card as an organic result plus a small "Promoted" line; `ad` is a
 * product advertisement; `suggestions` is the "people also searched" module
 * the page drops between results.
 */
export type ResultEntry =
  | { kind: "organic"; member: Member; position: number }
  | { kind: "promoted"; member: Member; slot: string }
  | { kind: "ad" }
  | { kind: "suggestions" };

export type ResultsPage = { total: number; page: number; pageCount: number; entries: ResultEntry[] };

/** Lowercase words of a headline, split wherever a letter or digit stops. */
function words(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * Whether a member is a result: every keyword begins some word of the
 * headline, the degree is one the filter allows, the member lives in a place
 * the location filter covers, and works at a company the company filter names.
 */
function matches(member: Member, query: PeopleQuery): boolean {
  const headline = words(member.headline);
  const keywords = words(query.keywords);
  if (!keywords.every((keyword) => headline.some((word) => word.startsWith(keyword)))) return false;
  if (query.network.length > 0 && !query.network.includes(member.degree)) return false;
  if (query.geo.length > 0 && !query.geo.some((id) => geoById(id)?.cities.includes(member.city))) return false;
  if (query.company.length > 0 && !query.company.includes(companySlug(member.company))) return false;
  return true;
}

export function companySlug(company: string): string {
  return company.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
}

/** Every member a query finds, in relevance order, before paging. */
export function peopleMatches(query: PeopleQuery): Member[] {
  return MEMBERS.filter((member) => matches(member, query));
}

/**
 * One page of results as the site serves it, including its defects:
 *
 * - page 1 carries a product advertisement after the third result and a
 *   promoted profile after the seventh; page 2 carries a promoted profile
 *   after the second. Advertisements follow the viewer, not the filters, so
 *   the promoted Lars Hoekstra appears whether or not the search found him --
 *   and when it did, he appears twice.
 * - from page 3 on, the index has moved on between requests, and the page
 *   opens with the last result of the page before it again.
 * - page 2 carries a "people also searched" module after its fifth result.
 */
export function peopleResultsPage(query: PeopleQuery): ResultsPage {
  const found = peopleMatches(query);
  const pageCount = Math.max(1, Math.ceil(found.length / PEOPLE_PAGE_SIZE));
  const page = query.page;
  const start = (page - 1) * PEOPLE_PAGE_SIZE;
  const organic: ResultEntry[] = found.slice(start, start + PEOPLE_PAGE_SIZE).map((member, index) => ({ kind: "organic", member, position: start + index + 1 }));
  if (organic.length === 0) return { total: found.length, page, pageCount, entries: [] };
  if (page >= 3) {
    const repeated = found[start - 1];
    if (repeated) organic.unshift({ kind: "organic", member: repeated, position: start });
  }
  const entries = [...organic];
  const insertAfter = (count: number, entry: ResultEntry) => {
    let seen = 0;
    const index = entries.findIndex((candidate) => candidate.kind === "organic" && ++seen === count);
    entries.splice(index < 0 ? entries.length : index + 1, 0, entry);
  };
  if (page === 1) {
    insertAfter(3, { kind: "ad" });
    insertAfter(7, { kind: "promoted", member: memberNamed("Sanne de Wit"), slot: "srp-1" });
  }
  if (page === 2) {
    insertAfter(2, { kind: "promoted", member: memberNamed("Lars Hoekstra"), slot: "srp-2" });
    insertAfter(6, { kind: "suggestions" });
  }
  return { total: found.length, page, pageCount, entries };
}

/** Result counts the way the page prints them, with a thousands separator. */
export function resultCountText(total: number): string {
  return total === 1 ? "1 result" : `${total.toLocaleString("en-US")} results`;
}
