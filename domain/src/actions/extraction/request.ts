// The request half of `web.dom.extract_list` (contract C1): what a list
// extraction asks the page to read, in the one shape a Flow authors, the
// parameter lift validates (`client/gateway-action-parameters.ts`), and the
// content script runs.
//
// A field may still be today's string grammar -- a selector, a
// `selector@attribute`, or `column:<header text>` -- so every existing Flow and
// scenario keeps its meaning. The spec form says the same things by name and
// adds what a string cannot: whether a record may lack the field, whether its
// column is read at all (D12), and the element it was picked from.
//
// `WebAutomationElementFingerprint` is imported type-only from `../types`,
// which re-exports this module. The import is erased, so the two files name
// each other with no runtime cycle, as `types.ts` already does with the failure
// record.

import type { WebAutomationElementFingerprint } from "../types";

/** What a structured field reads inside each item: its text, an attribute, a link's target, a control's value, or the cell under a table header. */
export type WebAutomationExtractFieldKind = "text" | "attribute" | "link" | "value" | "column";

/**
 * What becomes of a field's column (D12, D13). `include` reads it, and is what
 * an absent handling means. `exclude` leaves the column out entirely: the page
 * never reads its values, so it is absent from the output, the saved table, the
 * preview and every export. `encrypt` is reserved for the Encrypt column (Core
 * K11) and is refused at dispatch with `web.action.not_implemented` until that
 * is built.
 */
export type WebAutomationExtractFieldHandling = "include" | "exclude" | "encrypt";

export type WebAutomationExtractFieldSpec = {
  kind: WebAutomationExtractFieldKind;
  /** Where inside the item the value is read; absent, the item itself. */
  selector?: string | undefined;
  /** The attribute an `attribute` field reads. Required by that kind and refused on every other. */
  attribute?: string | undefined;
  /** The header text a `column` field reads under. Required by that kind and refused on every other. */
  header?: string | undefined;
  /**
   * `true` marks the field required: a record the page cannot read it from fails
   * the read's post-condition. Absent, or `false`, the field is optional and such
   * a record carries `null` for it instead (D16) -- which is what the string
   * grammar means too, since it has no way to say otherwise.
   *
   * Optional is the default, and since 2026-09-26 only because it was the other
   * way round and cost a read: every string-grammar field asserted `required`, so
   * three ratingless cards of forty-three failed the whole verb and forty good
   * rows were stored as nothing. The gap is stated instead of failed
   * (`apps/extension/src/content/extraction/field-spec.ts` decides it; the read's
   * summary states it).
   */
  required?: boolean | undefined;
  handling?: WebAutomationExtractFieldHandling | undefined;
  /** The element the field was picked from, as the one fingerprint normalizer describes it. */
  element?: WebAutomationElementFingerprint | undefined;
};

/** One field: today's string grammar, or the structured spec. */
export type WebAutomationExtractField = string | WebAutomationExtractFieldSpec;

/**
 * One condition an item must satisfy to be read as a record (contract C5).
 *
 * **Which items, not just which columns.** A detected run is every element the
 * page renders from one template, and a results page renders its advertisements
 * from the same template as its results: the everything store's four sponsored
 * placements are the same card as its sixteen results, with a grey "Sponsored"
 * label pushed in front. So a read of "every product on the first page, leaving
 * out sponsored placements" returned twenty rows where sixteen were asked for,
 * and the columns were right while the row set was wrong.
 *
 * What the condition tests is **a value the page states**, named the way every
 * other read here is named: a field of this request by key, or a field of its
 * own for a value the record does not carry. Never a word found somewhere in
 * the item's prose: a word-list heuristic that guessed which cards were
 * advertisements was deleted on 2026-09-18 and is not wanted back.
 *
 * What may be said about that value, and what each phrase means, is
 * `./condition-grammar.ts` and `./condition-match.ts`. In short:
 *
 * - `is` tests whether the page has the value at all, which is the whole of
 *   what a mark says: `absent` keeps the items that do not carry it;
 * - a bound and `equals` test the number in the value -- `$1,299.00` is 1299,
 *   `3.7 out of 5 stars` is 3.7, `16.00 USD` is 16 -- and an item whose value is
 *   missing or holds no number fails one, because a row with no price is not a
 *   row under $50;
 * - `matches`, `contains`, `startsWith`, `endsWith` and a string `equals` test
 *   the value's text, ignoring its layout and its case;
 * - `not` inverts the whole condition, which is how an exclusion is written.
 *
 * Each of the last three takes one value or a list of them, and a list means
 * any of them. Every phrase written must hold before `not` is applied.
 *
 * An empty condition -- neither `is` nor a comparison -- means `is: "present"`.
 *
 * A condition that names no value at all, and so says nothing about one, is a
 * no-op: `read-request.ts` drops it, names it in the read's `dropped`, and keeps
 * every row. It is never a refusal of the read, and never a filter that quietly
 * removes something.
 *
 * `field` is resolved against the keys this request reads rather than matched
 * against them exactly: a key written in another casing, with other separators,
 * or misspelled inside a word resolves to the column it plainly means, and the
 * read says that it assumed (`read-request.ts`).
 */
export type WebAutomationExtractItemCondition = {
  /** A key of this request's `fields`, whose value the condition tests. Exactly one of `field` and `read`. */
  field?: string | undefined;
  /** What the condition reads inside the item, for a value the record does not carry. Exactly one of `field` and `read`. */
  read?: WebAutomationExtractField | undefined;
  /** Whether the item must have the value or must not. Refused beside a comparison, which already requires one. */
  is?: "present" | "absent" | undefined;
  /** The number in the value must be at least this. */
  atLeast?: number | undefined;
  /** The number in the value must be at most this. */
  atMost?: number | undefined;
  /** The number in the value must be below this. */
  lessThan?: number | undefined;
  /** The number in the value must be above this. */
  greaterThan?: number | undefined;
  /** The value must be one of these: a number against the number in it, a string against its text. */
  equals?: WebAutomationExtractConditionValue | WebAutomationExtractConditionValue[] | undefined;
  /** The value's text must match one of these regular expressions. A bare source ignores case; `/source/flags` says what the flags say. */
  matches?: string | string[] | undefined;
  /** The value's text must contain one of these. */
  contains?: string | string[] | undefined;
  /** The value's text must start with one of these. */
  startsWith?: string | string[] | undefined;
  /** The value's text must end with one of these. */
  endsWith?: string | string[] | undefined;
  /** Keep the items the rest of this condition rejects, and reject the ones it keeps. How an exclusion is written. */
  not?: boolean | undefined;
};

/** One thing a value may be compared with: a number, read against the number the value states, or a string, read against its text. */
export type WebAutomationExtractConditionValue = string | number;

export const WEB_AUTOMATION_EXTRACT_CONDITION_PRESENCE = ["present", "absent"] as const satisfies readonly NonNullable<WebAutomationExtractItemCondition["is"]>[];

/**
 * How `web.dom.extract_list` reaches records past the first page, named as the
 * scenario contract's `ScenarioExtractPagination` names them (D14):
 *
 * - `next`, which is also what an absent `mode` means: follow the `next`
 *   control until it is absent or `maxPages` pages, the first included, were
 *   read;
 * - `loadMore`: press `control` to append items, reading at most `maxPages`
 *   pages, the first included;
 * - `scroll`: scroll to load more items, at most `maxScrolls` times;
 * - `numbered`: visit the page controls `pages` selects, reading at most
 *   `maxPages` pages, the first included.
 *
 * Every bound is held to `WEB_AUTOMATION_EXTRACT_MAX_PAGES`, as the scenario
 * contract holds its own.
 */
export type WebAutomationExtractListPagination =
  | { mode?: "next" | undefined; next: string; maxPages: number }
  | { mode: "loadMore"; control: string; maxPages: number }
  | { mode: "scroll"; maxScrolls: number }
  | { mode: "numbered"; pages: string; maxPages: number };

/**
 * Which rows count as the same row, so each is kept once (`dedupe`).
 *
 * `by` is the field keys whose values together identify a row, always resolved
 * by the reader (`./order-request.ts`): an author who wrote only "list each
 * once" gets the list's link column, or every column when it has none. The
 * first occurrence in page order is kept, across every page and document the
 * read covers, after `where`.
 */
export type WebAutomationExtractListDedupe = {
  by: string[];
};

/** Which way a sort key runs. */
export type WebAutomationExtractSortOrder = "asc" | "desc";

/**
 * What a sort key's values are read as. `auto`, which is what an absent `as`
 * means, reads the column as dates when most of its values state one, as
 * numbers when most state one, and as text otherwise.
 */
export type WebAutomationExtractSortType = "auto" | "number" | "date" | "text";

/**
 * One key of a `sort`: a field of the request, the direction, and how its values
 * compare. A row whose value cannot be read as the key's type goes after every
 * row that can, whichever the direction, and the read says how many did.
 */
export type WebAutomationExtractListSortKey = {
  field: string;
  order: WebAutomationExtractSortOrder;
  as?: WebAutomationExtractSortType | undefined;
};

export const WEB_AUTOMATION_EXTRACT_SORT_ORDERS = ["asc", "desc"] as const satisfies readonly WebAutomationExtractSortOrder[];

export const WEB_AUTOMATION_EXTRACT_SORT_TYPES = ["auto", "number", "date", "text"] as const satisfies readonly WebAutomationExtractSortType[];

/** The most keys one `sort` compares by; a key past it can only break ties among ties. */
export const WEB_AUTOMATION_EXTRACT_MAX_SORT_KEYS = 4;

/** The pagination modes, in the order the scenario contract lists them. */
export const WEB_AUTOMATION_EXTRACT_PAGINATION_MODES = ["next", "loadMore", "scroll", "numbered"] as const satisfies readonly NonNullable<WebAutomationExtractListPagination["mode"]>[];

export const WEB_AUTOMATION_EXTRACT_FIELD_KINDS = ["text", "attribute", "link", "value", "column"] as const satisfies readonly WebAutomationExtractFieldKind[];

export const WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS = ["include", "exclude", "encrypt"] as const satisfies readonly WebAutomationExtractFieldHandling[];

/**
 * How `web.dom.extract` reads the one value it returns (contract C3): the
 * element's text, one of its attributes, a control's live value, or its inner
 * HTML. The page has always read these four modes off the untyped `options`
 * bag (`content/action-runtime/extract.ts`); this is the same vocabulary,
 * declared, so a recorded read reaches the page on a field the compiler checks.
 */
export type WebAutomationExtractReadMode = "text" | "attribute" | "value" | "html";

export const WEB_AUTOMATION_EXTRACT_READ_MODES = ["text", "attribute", "value", "html"] as const satisfies readonly WebAutomationExtractReadMode[];

/** `web.dom.extract`'s structured read. `attribute` is required by the `attribute` mode and refused on every other, as a field spec's is. */
export type WebAutomationExtractRead = {
  mode: WebAutomationExtractReadMode;
  attribute?: string | undefined;
};

/**
 * `web.dom.extract_list` over a repeating structure, mirroring the scenario
 * contract's extract step (`packages/test-contracts/src/scenario.ts`): `item`
 * selects each record's root, and `fields` maps a record field key (D16) to
 * what is read inside it. `selector@attribute` reads an attribute rather than
 * text, and `column:<header text>` reads the cell under that header when the
 * items are table rows, so extraction survives a column reorder.
 *
 * There is no request `timeoutMs`: the command's own `timeoutMs` bounds the
 * read (D14).
 *
 * **There is no request frame either, and that is the contract rather than an
 * omission.** A frame is addressed on the action, exactly as it is for a click
 * or a type: the command's `frameId` and `frameUrlPath` name the document
 * (`actions/types.ts`), `output-nodes/payloads.ts` carries both onto every
 * recorded `web.dom.*` node's parameters, `client/gateway-action-parameters.ts`
 * lifts them back off the dispatched command, and the extension delivers the
 * action into that frame (`runtime/action-runner.ts`), where the content script
 * reads its own `document` (`content/extraction/list-reader.ts`). So one
 * extraction reads one document -- the frame it was delivered to -- and a
 * recorded extraction already replays into the frame it was recorded in.
 *
 * A `frame` inside the request would be a second way to say what the command
 * already says, read by nothing, so `read-request.ts` refuses a request that
 * names one instead of dropping it and reading another document in silence.
 *
 * **Order and uniqueness have defaults, and since 2026-09-28 a request can say
 * otherwise.**
 *
 * - **Order is the page's order** unless `sort` says another. Records come back
 *   in the order the document renders the items, and pages in the order the read
 *   followed them (`content/extraction/list-reader.ts`). "Newest first" or
 *   "cheapest first" is `sort`, which runs over every page read, after `where`.
 * - **A row is read once across pages.** In the modes that move from page to
 *   page -- `next` and `numbered` -- and in a continued read, an item whose
 *   record repeats one an earlier page yielded is not read again, field for
 *   field. `dedupe` says which columns identify a row instead, and then applies
 *   within a page as well as across pages, in every mode.
 *
 * Both were refused here once, as belonging to a node that sorts. Live run
 * `run-mulwm2dc-0bd95f22` settled it: asked for job-board roles "deduplicated,
 * newest first", the verifier said to add dedupe and sort and the repair had
 * nowhere to write either. The standing rule is that an instruction's qualifying
 * clauses are the extraction node's own parameters. Neither is written inside a
 * detected list's handle form, whose resolver admits a fixed set of keys: the
 * node carries `dedupe` and `sort` beside `extractList` and its dispatch folds
 * them in (`output-nodes/extract-list/dispatch.ts`).
 *
 * What is top-frame-only is the definition lane, not this contract: the picker
 * takes a pick from frame 0 alone, and `background/extraction/confirm.ts`
 * dispatches both the user's Confirm and the Lab's `fluxiq.test.defineExtraction`
 * with `frameId: 0`. So nothing defines an extraction in a child frame today,
 * and making one do so is a change there rather than here.
 */
export type WebAutomationExtractListRequest = {
  item: string;
  /** The element the item selector was generalized from, as the one fingerprint normalizer describes it. */
  itemElement?: WebAutomationElementFingerprint | undefined;
  fields: Record<string, WebAutomationExtractField>;
  paginate?: WebAutomationExtractListPagination | undefined;
  /** At most this many records, held to `WEB_AUTOMATION_EXTRACT_MAX_ITEMS`, which is also the bound when absent. */
  maxItems?: number | undefined;
  /**
   * At least this many records, or the read fails as `output_not_observed` (or
   * `auth_required` on a sign-in gate). Default 1, so a list that matched
   * nothing is never a success; a workflow where an empty list is a valid
   * answer declares `0`. A request whose minimum exceeds its maximum is
   * refused whole, since no page could satisfy it.
   *
   * It counts the records the read **kept**, so a filtered read declares how
   * many rows the answer must have, not how many the page must render.
   */
  minItems?: number | undefined;
  /**
   * Which items are records. Every condition must hold, or the item is not
   * read at all: it is absent from the records, from `maxItems`, from the
   * dataset and from `missingFields`, exactly as if the page had not rendered
   * it. Absent, every item of the run is a record, which is what a read with
   * no `where` has always meant.
   *
   * A condition tests a column the author named, and only that column. A mark
   * the page's own author wrote -- an ad label, a `data-ad-id`, a pinned badge
   * -- is a fact about the item, and so is the text of a column someone pointed
   * at. What this contract still cannot express, deliberately, is a search for
   * a word *somewhere* in an item: the product inferring which words matter is
   * the guess this repository deleted on 2026-09-18, and a person naming the
   * words they do not want in a column they named is not that.
   */
  where?: WebAutomationExtractItemCondition[] | undefined;
  /** Keep one row per value of these columns, the first in page order, across every page read. */
  dedupe?: WebAutomationExtractListDedupe | undefined;
  /**
   * The order the rows are answered in, over every page read, by each key in
   * turn and then by page order. With a sort, `maxItems` keeps the first rows of
   * the sorted answer rather than the first rows read.
   */
  sort?: WebAutomationExtractListSortKey[] | undefined;
};

/** Upper bound on the pages one `web.dom.extract_list` may follow, mirroring the scenario contract's own. */
export const WEB_AUTOMATION_EXTRACT_MAX_PAGES = 50;

/**
 * Upper bound on the records one `web.dom.extract_list` may return, across every
 * page it reads, and the bound a request that names none is held to. The page
 * mirrors it (`content/action-runtime/list-extraction.ts`) with a test that the
 * two agree.
 */
export const WEB_AUTOMATION_EXTRACT_MAX_ITEMS = 1_000;

/**
 * How long the page is given to read **one** page of a list, which is what
 * `list-extraction.ts` waits for each page today.
 *
 * The request carries no timeout of its own (D14): the command's `timeoutMs`
 * bounds the whole read, and Core sends the recorded node's 5,000 ms default
 * unless the node states another. So a paginated read has to state one.
 */
export const WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS = 10_000;

/**
 * The timeout a recorded `extract_list` node declares: the per-page wait times
 * the pages the request may read, which is `maxPages` for every mode that
 * follows pages and `maxScrolls` for `scroll`. An unpaginated read reads one
 * page and takes the per-page wait unmultiplied.
 *
 * Without the scaling, a read of 3 pages inherits Core's 5,000 ms default and
 * is cut short by the first page it waits for (D14, `x3-x5-execution`
 * correction 2).
 */
export function webAutomationExtractListTimeoutMs(request: WebAutomationExtractListRequest): number {
  const paginate = request.paginate;
  const pages = paginate === undefined ? 1 : paginate.mode === "scroll" ? paginate.maxScrolls : paginate.maxPages;
  return WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS * pages;
}
