import { ROOT } from "../shell/index.js";
import type { Degree } from "../types.js";

/** What a people search asks for, as its address carries it. Empty lists mean "any". */
export type PeopleQuery = { keywords: string; network: Degree[]; geo: string[]; company: string[]; page: number };

const DEGREES: readonly Degree[] = ["F", "S", "O"];

/**
 * Reads a people-search address the way the site writes it: list filters as
 * JSON arrays in the query string (`network=["S"]`), which is how the real
 * thing encodes them, with a comma list accepted as well because people edit
 * these addresses by hand.
 */
export function readPeopleQuery(query: URLSearchParams): PeopleQuery {
  const page = Number.parseInt(query.get("page") ?? "1", 10);
  return {
    keywords: (query.get("keywords") ?? "").trim(),
    network: readList(query.get("network")).filter((value): value is Degree => DEGREES.includes(value as Degree)),
    geo: readList(query.get("geoUrn")),
    company: readList(query.get("currentCompany")),
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
  };
}

/** The address of a people search, filters in the site's own encoding. Page 1 carries no page parameter. */
export function peopleSearchHref(query: PeopleQuery): string {
  const parts = [`keywords=${encodeURIComponent(query.keywords)}`];
  if (query.network.length > 0) parts.push(`network=${encodeURIComponent(JSON.stringify(query.network))}`);
  if (query.geo.length > 0) parts.push(`geoUrn=${encodeURIComponent(JSON.stringify(query.geo))}`);
  if (query.company.length > 0) parts.push(`currentCompany=${encodeURIComponent(JSON.stringify(query.company))}`);
  parts.push("origin=FACETED_SEARCH");
  if (query.page > 1) parts.push(`page=${query.page}`);
  return `${ROOT}search/results/people/?${parts.join("&")}`;
}

function readList(value: string | null): string[] {
  if (value === null || value.trim() === "") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    /* best-effort: not JSON means a hand-edited comma list, read below */
  }
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}
