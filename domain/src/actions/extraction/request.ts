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
  /** `false` marks the field optional: a record the page cannot read it from carries `null` for it (D16). */
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
 * own for a value the record does not carry. A sponsored card is told apart
 * from an organic one by the mark its own author put on it -- the ad label it
 * carries, the `data-ad-id` on its container -- and never by reading its words
 * and guessing. This repository deleted a word-list heuristic on 2026-09-18
 * and does not want it back under another name, so there is deliberately no
 * substring or equality test over page text here; see `where` below.
 *
 * `is` tests whether the page has the value at all, which is what a mark is:
 * `absent` keeps the items that do not carry it. A numeric bound tests the
 * number in the value -- `$1,299.00` is 1299, `4.5 out of 5 stars` is 4.5 --
 * and an item whose value is missing or holds no number fails it, because a row
 * with no price is not a row under $50.
 *
 * An empty condition -- neither `is` nor a bound -- means `is: "present"`.
 */
export type WebAutomationExtractItemCondition = {
  /** A key of this request's `fields`, whose value the condition tests. Exactly one of `field` and `read`. */
  field?: string | undefined;
  /** What the condition reads inside the item, for a value the record does not carry. Exactly one of `field` and `read`. */
  read?: WebAutomationExtractField | undefined;
  /** Whether the item must have the value or must not. Refused beside a bound, which already requires one. */
  is?: "present" | "absent" | undefined;
  /** The number in the value must be at least this. */
  atLeast?: number | undefined;
  /** The number in the value must be at most this. */
  atMost?: number | undefined;
  /** The number in the value must be below this. */
  lessThan?: number | undefined;
  /** The number in the value must be above this. */
  greaterThan?: number | undefined;
};

/** What a condition may say about its value, beside naming it. Every key a condition may carry is one of these or names the value. */
export const WEB_AUTOMATION_EXTRACT_CONDITION_BOUNDS = ["atLeast", "atMost", "lessThan", "greaterThan"] as const satisfies readonly (keyof WebAutomationExtractItemCondition)[];

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
   * There is no condition that matches page text, and that is the contract
   * rather than an omission. A mark the page's own author wrote -- an ad label,
   * a `data-ad-id`, a pinned badge -- is a fact about the item; a word found in
   * its prose is a guess about what the words mean, and this repository has
   * already paid for one of those. A read that can only be expressed by
   * matching words is a read this contract deliberately cannot express.
   */
  where?: WebAutomationExtractItemCondition[] | undefined;
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
