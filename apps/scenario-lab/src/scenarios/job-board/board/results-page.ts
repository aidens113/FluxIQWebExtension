import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { adKey, pageOfResults, recommendationsFor, RESULTS_PATH, searchHref, searchPostings, sponsoredFor, type SearchQuery } from "../catalog/index.js";
import type { JobBoardState, Posting } from "../types.js";
import { cardMarkup } from "./card.js";
import { rotatingId, type BoardClasses } from "./classes.js";
import { boardDocument, classesFor } from "./shell.js";

type FilterOption = { label: string; changes: Partial<SearchQuery> };
type Filter = { name: string; active: (query: SearchQuery) => boolean; options: readonly FilterOption[] };

/** The filter pills, each a button that opens a menu of links, as job boards build them. */
const FILTERS: readonly Filter[] = [
  { name: "Date posted", active: (query) => query.age !== "", options: [
    { label: "Last 24 hours", changes: { age: "1" } }, { label: "Last 3 days", changes: { age: "3" } },
    { label: "Last 7 days", changes: { age: "7" } }, { label: "Last 14 days", changes: { age: "14" } }, { label: "Any time", changes: { age: "" } },
  ] },
  { name: "Remote", active: (query) => query.wp !== "", options: [
    { label: "Remote only", changes: { wp: "remote" } }, { label: "Hybrid", changes: { wp: "hybrid" } },
    { label: "On-site", changes: { wp: "onsite" } }, { label: "Any work setting", changes: { wp: "" } },
  ] },
  { name: "Salary", active: (query) => query.sal !== "", options: [
    { label: "£40,000+", changes: { sal: "40000" } }, { label: "£60,000+", changes: { sal: "60000" } },
    { label: "£70,000+", changes: { sal: "70000" } }, { label: "£90,000+", changes: { sal: "90000" } }, { label: "Any salary", changes: { sal: "" } },
  ] },
  { name: "Job type", active: (query) => query.type !== "", options: [
    { label: "Full-time", changes: { type: "fulltime" } }, { label: "Contract", changes: { type: "contract" } },
    { label: "Part-time", changes: { type: "parttime" } }, { label: "Any job type", changes: { type: "" } },
  ] },
];

/**
 * A results page. `freshLive` is whether the fresh posting has gone live by
 * the time this page is served -- it goes live the moment a second or later
 * page is asked for, so page two is computed over a list one longer than page
 * one was, and the last result of page one is shown again at the top of page
 * two. The count in the header is the board's cached count and never includes
 * that posting.
 *
 * The pager's Next link is broken past page one: from page two on it points at
 * the page it is on. The numbered links work.
 */
export function renderResultsPage(state: JobBoardState, query: SearchQuery, context: RenderContext, freshLive: boolean): string {
  const c = classesFor(context);
  const results = searchPostings(state.mode, query, freshLive);
  const { items, page, pages } = pageOfResults(results, query);
  const sponsored = sponsoredFor(state.mode, query, page);
  const cached = results.filter((posting) => !posting.fresh).length;
  const cards = [
    ...(sponsored[0] ? [cardMarkup(c, state, context.seed, sponsored[0], true)] : []),
    ...items.slice(0, 5).map((posting) => cardMarkup(c, state, context.seed, posting, false)),
    ...(sponsored[1] ? [cardMarkup(c, state, context.seed, sponsored[1], true)] : []),
    ...items.slice(5).map((posting) => cardMarkup(c, state, context.seed, posting, false)),
  ];
  const recommendations = results.length === 0 ? recommendationsFor(state.mode, query) : [];
  const listing = results.length > 0
    ? `<ol class="${c.list}">${cards.join("")}</ol>${pagerMarkup(c, query, page, pages)}`
    : `<div class="${c.empty}"><h2>No jobs found for ${escapeHtml(describe(query))}</h2><p>Try fewer words, check the spelling, or remove a filter.</p></div>`
      + (sponsored.length > 0 ? `<ol class="${c.list}">${sponsored.map((posting) => cardMarkup(c, state, context.seed, posting, true)).join("")}</ol>` : "")
      + `<h3 class="${c.recommend}">Jobs you might like</h3><ol class="${c.list}">${recommendations.map((posting) => cardMarkup(c, state, context.seed, posting, false)).join("")}</ol>`;
  const body = `${searchFormMarkup(c, context.seed, query)}
<div class="${c.filters}">${FILTERS.map((filter) => filterMarkup(c, query, filter)).join("")}</div>
<div class="${c.meta}"><h1 class="${c.metaTitle}">${escapeHtml(describe(query))}</h1><span class="${c.count}">${results.length === 0 ? "0 jobs" : `Page ${page} of ${cached} jobs`}</span>
<span class="${c.sort}">Sort by: ${query.sort === "relevance" ? "<b>relevance</b>" : `<a href="${searchHref(query, { sort: "relevance", page: 1 })}">relevance</a>`} - ${query.sort === "date" ? "<b>date</b>" : `<a href="${searchHref(query, { sort: "date", page: 1 })}">date</a>`}</span></div>
<div class="${c.layout}"><div class="${c.left}">${listing}
<label class="${c.perPage}">Jobs per page <select name="limit">${[10, 25, 50].map((limit) => `<option value="${limit}"${limit === query.limit ? " selected" : ""}>${limit}</option>`).join("")}</select></label></div>
<aside class="${c.pane}"><div class="${c.paneEmpty}">Select a job to see its details</div></aside></div>`;
  const data = {
    words: query.q,
    ads: Object.fromEntries([...sponsored].map((posting: Posting) => [adKey(posting), posting.key])),
    companies: Object.fromEntries([...items, ...sponsored, ...recommendations].map((posting) => [posting.key, posting.company])),
    limitHrefs: Object.fromEntries([10, 25, 50].map((limit) => [String(limit), searchHref(query, { limit: limit as SearchQuery["limit"], page: 1 })])),
  };
  return boardDocument({ state, context, kind: "results", title: `${describe(query)} - Rolefinch`, body, data });
}

/** The search form every results page and the home page carry. Its field ids rotate with the seed. */
export function searchFormMarkup(c: BoardClasses, seed: number, query: Pick<SearchQuery, "q" | "l">): string {
  const what = rotatingId(seed, "text-input-what", "q");
  const where = rotatingId(seed, "text-input-where", "l");
  return `<form class="${c.search}" action="${RESULTS_PATH}" method="get">`
    + `<div class="${c.field}"><label class="${c.fieldLabel}" for="${what}">What</label><input class="${c.fieldInput}" id="${what}" name="q" value="${escapeHtml(query.q)}" placeholder="Job title, keywords or company"></div>`
    + `<div class="${c.field}"><label class="${c.fieldLabel}" for="${where}">Where</label><input class="${c.fieldInput}" id="${where}" name="l" value="${escapeHtml(query.l)}" placeholder="Town, county or &quot;remote&quot;"></div>`
    + `<button class="${c.searchButton}" type="submit">Find jobs</button></form>`;
}

function filterMarkup(c: BoardClasses, query: SearchQuery, filter: Filter): string {
  const options = filter.options.map((option) => {
    const chosen = (Object.keys(option.changes) as Array<keyof SearchQuery>).every((key) => query[key] === option.changes[key]);
    return `<a class="${c.pillOption}${chosen ? ` ${c.pillChosen}` : ""}" href="${searchHref(query, { ...option.changes, page: 1 })}">${escapeHtml(option.label)}</a>`;
  }).join("");
  return `<div class="${c.pillWrap}"><button type="button" class="${c.pill}${filter.active(query) ? ` ${c.pillActive}` : ""}">${filter.name}</button><div class="${c.pillMenu}" hidden>${options}</div></div>`;
}

function pagerMarkup(c: BoardClasses, query: SearchQuery, page: number, pages: number): string {
  if (pages === 1) return "";
  const link = (target: number, label: string) => `<a class="${c.pageLink}" href="${searchHref(query, { page: target })}">${label}</a>`;
  const numbers = Array.from({ length: pages }, (_, index) => index + 1).map((number) => (number === page ? `<b class="${c.pageCurrent}">${number}</b>` : link(number, String(number))));
  const previous = page > 1 ? link(page - 1, "Previous") : "";
  // The board's pager bug: past page one, Next is built from the page the visitor is on.
  const next = page < pages ? link(page === 1 ? 2 : page, "Next") : "";
  return `<nav class="${c.pager}">${previous}${numbers.join("")}${next}</nav>`;
}

function describe(query: SearchQuery): string {
  const what = query.q ? `${query.q} jobs` : "All jobs";
  return query.l ? `${what} in ${query.l}` : what;
}
