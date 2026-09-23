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
//
// **A detected list comes first.** The model is never shown a selector, so a
// literal request is a guess. Live, every catalog build that detected the list
// still wrote one, because this text offered nothing else, and each read 8
// cards with no name, price, rating or url (`run-mu4wwkbc-df6cfe60`). So the
// description says to detect the list, and the grammar leads with the handle
// form the resolver takes (`runtime/llm-evidence/plan-resolution/`): which
// detected columns to keep and under which key, a link's href as written, and
// reading only the page shown. The literal request follows for a list nothing
// detected.
//
// **The node saves its own rows.** With the list resolved, the next live build
// read all 8 cards with every field, then failed on a `write-records` node the
// model added to save them, whose record output did not parse
// (`run-mu4yk4u1-60a1c3a4`). "Saved without a recordOutput" had not said that
// no other node is needed, so the description now does.

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

/** The node's description: what it is for, how its list is named, and that saving needs nothing more. */
export const WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION = [
  "Scrape every item of a repeating list or table into a dataset, across pages.",
  "Detect the list with web.detect_repeating_structure; name it in extractList by its handle.",
  "It saves its rows itself: no recordOutput or save node needed."
].join(" ");

/**
 * The shape of `extractList`, for a model to write one: the handle of a
 * detected list first, then the literal request.
 *
 * **What `where` costs here, and where the rest of it went.** Core cuts a
 * parameter description at 600 characters and the string was already at 595, so
 * the conditions that say which items are records (C5) are shown as the one
 * shape a model copies and nothing more. What each condition may say --
 * `is: "present"`, `is: "absent"`, and `atLeast`, `atMost`, `lessThan`,
 * `greaterThan` on the number in the column -- is written out in the detect
 * tool's own description (`runtime/llm-evidence/tools.ts`), which has no bound
 * and which a model must read before it can name a handle at all. Two things
 * were given up for the room, both in the literal branch the text itself calls
 * a guess: `required?: false` in its field spec, and its own `where` example.
 * The resolver still accepts both, and a literal request is the fallback for a
 * list nothing detected -- the path this text exists to steer a model away from.
 */
export const WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR = [
  `Detected: {handle: "extraction.N", fields?: {key: "detectedKey" | "detectedKey@href"}, where?: [{field: "detectedKey", is: "absent"}], paginate?: false (this page only)};`,
  "fields: those columns renamed; link reads the absolute URL, @href the raw href.",
  `Else {item: css, fields: {key: "css"|"css@attr"|"column:Header"|{kind: ${WEB_AUTOMATION_EXTRACT_FIELD_KINDS.join("|")}, selector?, attribute?, header?}},`,
  `paginate?: {mode: "next", next: css, maxPages} (loadMore: control, numbered: pages)|{mode: "scroll", maxScrolls}, max ${WEB_AUTOMATION_EXTRACT_MAX_PAGES}}.`,
  `Keys A-Za-z0-9_-. Both take minItems (default 1; 0 allows none), maxItems (max ${WEB_AUTOMATION_EXTRACT_MAX_ITEMS}).`
].join(" ");

/**
 * One request the page would run: a paginated product list.
 *
 * It names `minItems` as well, although 1 is the default and the value is
 * therefore the same request. Core reads a parameter's example as the
 * declaration of which keys belong inside that parameter
 * (`flow-bootstrap/authoring/matching.ts`), so a key the example omits is one
 * a model writing it beside `extractList` is refused for. `minItems` is the
 * key a Flow needs whenever the correct answer may be no rows at all, which is
 * every filtered read, and the campaign of 2026-09-17 had two such tasks return
 * whole unfiltered lists.
 *
 * `where` is here for the same reason and it is the sharper case: a key the
 * example omits is a key the model is refused for writing beside `extractList`,
 * so an example with no `where` is an example that cannot be narrowed to the
 * rows a person asked for. It shows the literal form, since the example is a
 * literal request; the detected form names a detected column by `field`.
 */
export const WEB_AUTOMATION_EXTRACT_LIST_EXAMPLE: JsonObject = {
  item: "li.product",
  fields: { name: ".name", price: ".price", url: "a@href" },
  where: [{ read: ".sponsored-label", is: "absent" }],
  paginate: { mode: "next", next: "a.next", maxPages: 5 },
  minItems: 1
};
