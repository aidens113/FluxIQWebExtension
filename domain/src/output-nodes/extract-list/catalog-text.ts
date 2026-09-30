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
  WEB_AUTOMATION_EXTRACT_MAX_ITEMS,
  WEB_AUTOMATION_EXTRACT_MAX_PAGES,
  WEB_AUTOMATION_EXTRACT_PAGINATION_MODES
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

/**
 * The node's description: what it is for, how its list is named, and that
 * saving needs nothing more.
 *
 * **It used to promise "across pages", and the model believed it.** This is the
 * first thing a model reads about the node, and a node that says it scrapes
 * every item across pages is a node that will be written to do exactly that --
 * whatever the instruction asked for.
 *
 * Measured on 2026-09-24, and the pair is what settles it. Told to scrape "the
 * products shown on the first page of the catalog", the model authored
 * `paginate: { maxPages: 3 }` and returned all 23 products where 8 were
 * expected (`run-muf2r0wd-29c637d3`). Told to scrape "every product in the
 * catalog, across all of its pages", it authored `paginate: { maxPages: 3 }` --
 * the same node, to the character -- and passed (`run-muf33l1g-2b7385aa`).
 * Opposite instructions, identical output: the request's scope was reaching the
 * authored node not at all, because the node had already told the model what it
 * does.
 *
 * Nine runs failed on this before the authored parameters were recorded and the
 * two could be compared. Two earlier fixes were aimed at the detector's
 * proposal and at the worked example, and neither was the cause; the sentence
 * above them was.
 */
export const WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION = [
  "Scrape the items of a repeating list or table into a dataset, one page or many.",
  "Detect the list with web.detect_repeating_structure; name it in extractList by its handle.",
  "It saves its rows itself: no recordOutput or save node needed."
].join(" ");

/**
 * The shape of `extractList`, for a model to write one: the handle of a
 * detected list first, then the literal request.
 *
 * **A model writes the shape it is shown, and until 2026-09-23 the shape it was
 * shown could only leave advertisements out.** `where` appeared here as one
 * condition, `{field, is: "absent"}`. The numeric bounds -- `atLeast`, `atMost`,
 * `lessThan`, `greaterThan` on the number in a column -- were written out only
 * in the detect tool's own description (`runtime/llm-evidence/tools.ts`), whose
 * paragraph about conditions is about telling an advertisement from a result.
 * Both first-page reads of the 2026-09-23 campaign did exactly that and no
 * more: each left the sponsored cards out and carried no other condition, under
 * instructions asking for items "rated 4.0 or higher and priced under $50"
 * (`run-mudwci8d-de88aa32`, `run-mudw1ktb-0557816b`). So the shape now shows a
 * bound beside the mark, and shows it over a column named by the plan's own
 * key, which is what a plan calls a column it keeps and the name it reaches for
 * next (`plan-resolution/extraction/conditions.ts`).
 *
 * **What the room for it cost.** Core cuts a parameter description at 600
 * characters. Three things went, each said better elsewhere or said by the
 * shape itself: "those columns renamed", which `{yourKey: "colKey"}` now shows;
 * and, in the literal branch the text itself calls a guess, `required?: false`
 * in its field spec and its own `where` example. The resolver still accepts
 * every one of them, and a literal request is the fallback for a list nothing
 * detected -- the path this text exists to steer a model away from.
 *
 * **The last clause says what a page budget is for, because nothing did.** The
 * grammar named `maxPages` and its ceiling and never said what the number does,
 * and a model reading it as a description of the page rather than a request for
 * that much of it writes the count it can see. On 2026-09-24 the same authored
 * node -- `paginate: { maxPages: 3 }` -- came back from "the products shown on
 * the first page of the catalog" and from "every product, across all of its
 * pages": opposite requests, identical output, one failing and one passing.
 * Three changes aimed elsewhere (the detector's proposal, the worked example,
 * this node's own description) each left that pair unchanged, which is what
 * pointed here. The clause needed room Core's 600-character parameter
 * description did not have, so Core's bound moved with it.
 *
 * **What the filtering vocabulary cost, and what paid for it.** On 2026-09-24
 * this text stood at 699 characters of Core's 700, and the everything-store run
 * carried five conditions in its instruction -- Plus eligible, rated 4.0 or
 * higher, under $50, not sponsored, no ear tips or charging cases -- into a Flow
 * that expressed none of them, returning 55 rows of which 13 were wanted and 0
 * matched (`run-mug1z9k9-ef625d8b`). Fitting the words for those five cost two
 * things, and both are the least-evidenced text here:
 *
 * - **the field-spec form** `{kind: text|attribute|...}` and its members. The
 *   string grammar still shows what a field may be, in the branch this text
 *   exists to steer a model away from, and the resolver accepts the spec form
 *   exactly as before. No live run has ever failed for want of it;
 * - **`Keys A-Za-z0-9_-`**, the field-key charset. A key outside it is refused
 *   before the Flow runs, by name, with `web.extract_list.invalid_field_key`
 *   (`./issues.ts`), which a model can repair from. A `where` clause that does
 *   not fit is not refused: it is truncated in silence, and the answer is
 *   simply wrong.
 *
 * That ordering is the rule this budget is spent by. A clause whose absence is
 * a **named refusal** is cheaper than a clause whose absence is a **wrong
 * answer**, so the refusable ones go first. At 697 of 700 there were three
 * characters left, which was the finding: the next measured clause had nowhere
 * to go, and Core's bound was where it would have to come from.
 *
 * **The next measured clause arrived the same day, and it says `where` is
 * optional.** With the vocabulary available, a build wrote conditions that
 * rejected every row and the run returned 0 records where 13 were wanted
 * (`run-mug3tnti-9ab80b85`, 30 provider calls). The run before it returned 55
 * unfiltered rows and the run after returned 10 with 7 right, so the capability
 * was working; what this text had done was make narrowing look compulsory, on a
 * first attempt, at the point where the model is least certain. The product
 * owner's words: "IT SHOULD BE ABLE TO INPUT MINIMAL INITIAL PARAMS IF IT WANTS
 * AND THEN THE REPAIR CAN IMPROVE IT LATER."
 *
 * So the clause leads with "optional" and says what omitting it does, and three
 * things paid for it, none of them a rule:
 *
 * - the third condition shape, `{contains: "case", not: true}`. The phrase is
 *   still named, and the shape is still shown where there is room for it -- the
 *   detect tool's own description, which the same build reads
 *   (`runtime/llm-evidence/tools.ts`);
 * - `(this page)` after `paginate?: false`, whose meaning the pagination clause
 *   now carries for both branches at once;
 * - **the literal branch's own `paginate`**, which was a second copy of the
 *   detected branch's. Saying pagination once, for both, is what bought the
 *   room, and it is also simply true.
 *
 * At 696 of 700 there are four characters left. The bound has not moved and the
 * pressure has not gone: two measured clauses have now been fitted by cutting,
 * and the next one has nowhere left to come from but Core's 700.
 *
 * **The third measured clause is `dedupe` and `sort`, and it was fitted the
 * same way on 2026-09-28.** Live run `run-mulwm2dc-0bd95f22` asked the job board
 * for roles "deduplicated, newest first"; the verifier's advice was to add
 * dedupe and sort, and the repair had nowhere to write either. Both now live
 * inside `extractList`, for both branches at once, as pagination does, and the
 * clause shows the least of each: `true` (each row once, by its link) or a
 * column, and one key with its direction. The reader takes every other
 * spelling (`actions/extraction/order-request.ts`). What paid for its 36
 * characters, none of them a rule:
 *
 * - `also` before the comparisons, and `(number)` after the numeric ones, which
 *   the shown bound `atLeast: 4, lessThan: 50` already says are numbers;
 * - the spaces around `=` in the link clause;
 * - "read only the page shown unless asked" became "one page unless asked",
 *   the same default in the words the clause before it already set up.
 *
 * At 698 of 700 there are two characters left.
 *
 * **The fourth is `badge: is: "present"`, fitted on 2026-09-29.** An icon badge
 * -- the everything store's `<i role="img" aria-label="Brightaisle Plus">` --
 * is now a detected column labelled by its constant accessible name
 * (`apps/extension/src/content/extraction/badge-name.ts`), and the column holds
 * the name where the badge is and `null` where it is not, so the one thing a
 * condition can say about it is whether it is there. The shape showed only
 * `is: "absent"`, the advertisement mark, and "Brightaisle Plus eligible" is the
 * other direction. What paid for its 22 characters, none of them a rule:
 *
 * - `Detected: ` before the handle form, which the handle itself says and the
 *   literal branch's `Or` still sets apart;
 * - `All hold; `, which the detect tool's description says in full ("Every
 *   condition must hold") to the same build (`runtime/llm-evidence/tools.ts`).
 *
 * At 700 of 700 there is nothing left.
 */
export const WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR = [
  `{handle: "extraction.N", fields?: {yourKey: "colKey"|"colKey@href"}, where?: [{field: "colKey", is: "absent"}, {field: "yourKey", atLeast: 4, lessThan: 50}], paginate?: false};`,
  "where is optional: omit it, keep every item, narrow later. atMost/greaterThan/equals, contains/startsWith/endsWith/matches (text); list = any; not: true inverts; badge: is: \"present\".",
  "link=absolute URL, @href=raw href.",
  "Or {item: css, fields: {key: css|css@attribute|column:<header>}}.",
  `paginate?: {mode: ${WEB_AUTOMATION_EXTRACT_PAGINATION_MODES.join("|")}, next|control|pages, maxPages|maxScrolls<=${WEB_AUTOMATION_EXTRACT_MAX_PAGES}}: pages to read, not pages present; one page unless asked.`,
  `dedupe?: true|key, sort?: "key desc"; minItems (default 1, 0 = none), maxItems <=${WEB_AUTOMATION_EXTRACT_MAX_ITEMS}.`
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
 *
 * **It is the least a read needs, plus the one exclusion that is nearly always
 * right**, and for a day it was the most instead. It briefly showed four
 * conditions -- the whole of an instruction asking for Plus-eligible products
 * rated 4.0 or higher and under $50, with no sponsored placements and no
 * accessories -- because that instruction had reached a Flow carrying none of
 * its conditions (`run-mug1z9k9-ef625d8b`). The next run over-corrected: with
 * the vocabulary available and an example showing four of it, a build wrote
 * conditions that rejected every row and returned 0 records where 13 were
 * wanted (`run-mug3tnti-9ab80b85`).
 *
 * An example is the only complete, valid request a model is shown, so it models
 * how much to write as much as what to write. The right posture is the one the
 * loop is built for: write the least the instruction needs, let the judgement
 * say the answer is too wide, let the repair narrow it. The mark stays because
 * leaving advertisements out of a results page is not a judgement call, and
 * because `where` has to appear here at all -- Core reads the example's
 * **top-level** keys as the declaration of what may be written beside
 * `extractList` (`flow-bootstrap/authoring/matching.ts`), so an example with no
 * `where` is a `where` a model is refused for writing there.
 *
 * What is inside `where` is therefore here to be copied rather than to be
 * permitted, and the shapes for the rest of the vocabulary are in the detect
 * tool's description, which has room for them
 * (`runtime/llm-evidence/tools.ts`). The example is sent whole or not at all and
 * is cut off above 600 bytes, which this is well inside.
 *
 * `dedupe` and `sort` are here for the reason `where` is, and since 2026-09-28:
 * Core sets a key a model writes beside `extractList` at `extractList.<key>`
 * only when this example declares it (`flow-bootstrap/authoring/matching.ts`),
 * and the node has no `dedupe` or `sort` of its own, so without them here a
 * "newest first" written on the step is refused rather than read.
 *
 * **They are declared at their off values, deliberately.** The example models
 * how much to write, and a sort copied from it onto a read that asked for none
 * is not a wider answer but a different one: with `maxItems`, "the first five
 * shown" would become "the cheapest five". `false` and `[]` declare the keys,
 * show where they go and change nothing; the grammar shows what they say.
 */
export const WEB_AUTOMATION_EXTRACT_LIST_EXAMPLE: JsonObject = {
  item: "li.product",
  fields: { name: ".name", price: ".price", url: "a@href" },
  where: [{ read: ".sponsored-label", is: "absent" }],
  dedupe: false,
  sort: [],
  paginate: { mode: "next", next: "a.next", maxPages: 5 },
  minItems: 1
};
