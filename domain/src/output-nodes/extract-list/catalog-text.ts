// What a model reads about the list extraction node when it builds a Flow.
//
// Core's Flow Bootstrap ranks node definitions against the instruction by id,
// label, description and tags (`flow-bootstrap/plan/ranking.ts`), and shows the
// model each chosen definition's description, and the description and example
// of each object or json parameter (`flow-bootstrap/plan/catalog.ts`). The
// request's schema stays in metadata, which the catalog does not send. So the
// tags carry the words people use when they ask for a scrape, the node's
// description says what it is for, and the `extractList` parameter carries the
// request's grammar and one example of it.
//
// The bounds are Core's: a node description is kept to 240 characters, and its
// first sentence stands alone within 80, where the catalog cut it before; a
// parameter description is kept to 600. The grammar takes its lists and bounds
// from the request's own constants, and the tests check every pagination mode
// and field kind appears in it, that it fits, and that the example is a request
// the page would run.

import type { JsonObject } from "fluxiq/core";
import {
  WEB_AUTOMATION_EXTRACT_FIELD_KINDS,
  WEB_AUTOMATION_EXTRACT_MAX_ITEMS,
  WEB_AUTOMATION_EXTRACT_MAX_PAGES
} from "../../actions/extraction";

/** Words of a scraping request. A tag of two words is ranked as both. */
export const WEB_AUTOMATION_EXTRACT_LIST_TAGS: readonly string[] = [
  "scrape",
  "collect",
  "extract",
  "list",
  "table",
  "rows",
  "records",
  "dataset",
  "every page",
  "next page",
  "load more",
  "infinite scroll",
  "pagination"
];

/** The node's description: what it is for, and that saving needs nothing more. */
export const WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION = [
  "Scrape every item of a repeating list or table into a dataset, across pages.",
  "The rows are saved without a recordOutput."
].join(" ");

/** The shape of `extractList`, for a model to write one. */
export const WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR = [
  "{ item, fields, paginate?, minItems?, maxItems? }. item: CSS selector of each record.",
  "fields: { key: \"css\" (text) | \"css@attr\" | \"column:Header\" (table cell)",
  `| { kind: ${WEB_AUTOMATION_EXTRACT_FIELD_KINDS.join("|")}, selector?, attribute?, header?, required?: false } };`,
  "keys use A-Za-z0-9_-; field selectors are read inside each item.",
  "paginate: { mode: \"next\", next: css, maxPages } | { mode: \"loadMore\", control: css, maxPages }",
  `| { mode: "scroll", maxScrolls } | { mode: "numbered", pages: css, maxPages }, at most ${WEB_AUTOMATION_EXTRACT_MAX_PAGES}.`,
  `minItems: default 1; 0 allows an empty list. maxItems: at most ${WEB_AUTOMATION_EXTRACT_MAX_ITEMS}.`
].join(" ");

/** One request the page would run: a paginated product list. */
export const WEB_AUTOMATION_EXTRACT_LIST_EXAMPLE: JsonObject = {
  item: "li.product",
  fields: { name: ".name", price: ".price", url: "a@href" },
  paginate: { mode: "next", next: "a.next", maxPages: 5 }
};
