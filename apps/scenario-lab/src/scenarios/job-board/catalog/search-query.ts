export const RESULTS_PATH = "/scenarios/job-board/jobs";

/**
 * A results page's query, as the URL carries it. Empty strings are "any".
 * `wp` is the workplace filter, `sal` the salary floor in pounds, `age` the
 * most days old a posting may be, and `limit` how many results a page holds.
 */
export type SearchQuery = {
  q: string;
  l: string;
  wp: "" | "remote" | "hybrid" | "onsite";
  sal: "" | "40000" | "60000" | "70000" | "90000";
  age: "" | "1" | "3" | "7" | "14";
  type: "" | "fulltime" | "contract" | "parttime";
  sort: "relevance" | "date";
  limit: 10 | 25 | 50;
  page: number;
};

export const DEFAULT_QUERY: SearchQuery = { q: "", l: "", wp: "", sal: "", age: "", type: "", sort: "relevance", limit: 10, page: 1 };

/** Reads a results URL's query, keeping only values the board's own controls could have written. */
export function parseSearchQuery(params: URLSearchParams): SearchQuery {
  const pick = <T extends string>(name: string, allowed: readonly T[], fallback: T): T => {
    const value = params.get(name) ?? "";
    return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
  };
  const limit = Number(params.get("limit"));
  const page = Number(params.get("page"));
  return {
    q: (params.get("q") ?? "").trim().slice(0, 80),
    l: (params.get("l") ?? "").trim().slice(0, 80),
    wp: pick("wp", ["", "remote", "hybrid", "onsite"], ""),
    sal: pick("sal", ["", "40000", "60000", "70000", "90000"], ""),
    age: pick("age", ["", "1", "3", "7", "14"], ""),
    type: pick("type", ["", "fulltime", "contract", "parttime"], ""),
    sort: pick("sort", ["relevance", "date"], "relevance"),
    limit: limit === 25 || limit === 50 ? limit : 10,
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
  };
}

/** The results URL for `query` with `changes` applied, carrying only what differs from the defaults. */
export function searchHref(query: SearchQuery, changes: Partial<SearchQuery> = {}): string {
  const next = { ...query, ...changes };
  const params = new URLSearchParams();
  for (const key of Object.keys(DEFAULT_QUERY) as Array<keyof SearchQuery>) {
    const value = next[key];
    if (value !== DEFAULT_QUERY[key] && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `${RESULTS_PATH}?${text}` : RESULTS_PATH;
}
