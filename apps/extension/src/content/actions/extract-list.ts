// The extract-list verb: read a repeating structure into records.
//
// The records become the result's `extracted`; the post-condition is that at
// least `minItems` records were read and every record carries every required
// field. A request that names `where` conditions counts only the items it kept
// (C5), so `minItems` says how many rows the answer must have rather than how
// many items the page must render. An optional field the page could not read is `null` in its record and
// fails nothing (D16). Either shortfall is a failed validation -- `output_not_observed` --
// because an empty list or a record list that quietly dropped a column looks
// exactly like a successful extraction to everything downstream. `minItems`
// defaults to 1 (decision D4): a workflow where an empty list is a valid
// answer says so with `minItems: 0`. An empty list on a sign-in gate is
// reported as `auth_required` by `results.ts`, which sees every result.
//
// Beside the records, every read that returned reports its own account as the
// result's `extraction` (C2): how many records, how many pages, whether a cap
// cut it short, how many items the selector named, how many rows came back
// empty, whether the page ever showed the list at all, what the wait for it did,
// and which required fields some record lacked. Its `fieldNames` are the
// request's field keys with excluded fields left out, because an excluded
// column is never read (D12). The domain's wire copy drops the whole summary
// when a missing field is not one of `fieldNames`, so the two lists are built
// from the same declared keys.
//
// The command's `timeoutMs` bounds the whole read. Running out of it is a
// `timed_out` result carrying the records and page count that were read, and
// no promise about which page is showing (decision D5).
//
// The capability is awaited here and its throws are caught here, which is belt
// and braces: `execute.ts` awaits every branch, so its catch would report a
// rejection from this verb anyway. The local catch is kept because it costs
// nothing and keeps this verb's failure path local -- a throw from
// `deps.extractList` is reported as this verb failing, at this verb's
// `startedAt`, whatever the dispatcher does. (Until 2026-09-11 the dispatcher
// returned this promise unawaited, and the catch was load-bearing.) A field
// that resolved to a sensitive control is one such throw, and it carries its
// own ACTION_REJECTED record; an `encrypt` field, which the page does not read
// until the Encrypt column is built, is another, carrying NOT_IMPLEMENTED.
//
// **A command that carries `rejectedSamples: true` beside `extractList` also
// gets a few of the rows each `where` condition rejected**, on the summary's
// `rejectedSamples`. Only the exploring model's own node run sends it, so the
// model that wrote a condition can see which rows it turned down
// (`domain/src/runtime/llm-evidence/node-run/rejected-rows.ts`); a Flow played
// back never does, and its summary carries no rows.

import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation, WebAutomationExtractListRequest } from "../types";
import type { ContentActionDependencies } from "./types";

type Outcome = Awaited<ReturnType<ContentActionDependencies["extractList"]>>;
type ExtractionSummary = NonNullable<BrowserActionResult["extraction"]>;

/** The command parameter that asks for rejected-row samples, spelled as the summary member that carries them. */
const REJECTED_SAMPLES = "rejectedSamples" satisfies keyof ExtractionSummary;

export async function extractListAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): Promise<BrowserActionResult> {
  const request = action.extractList;
  if (!request) return deps.failure(action, new Error("web.dom.extract_list needs extractList parameters."), startedAt);
  try {
    const sampleRejected = action.options?.[REJECTED_SAMPLES] === true;
    const outcome = await deps.extractList(request, { timeoutMs: action.timeoutMs, ...(sampleRejected ? { sampleRejected } : {}) });
    const minItems = minimumItems(request.minItems);
    const fieldNames = includedFieldNames(request);
    const expected = `at least ${count(minItems, "record")}, each carrying ${fieldNames.join(", ")}`;
    const evidence = { extracted: outcome.records, extraction: summaryOf(outcome, fieldNames), snapshot: deps.captureSnapshot() };
    if (outcome.timedOut) {
      return deps.timedOut(action, startedAt, `Timed out extracting the list after ${count(outcome.pagesRead, "page")}.`, {
        status: "failed",
        expected,
        actual: `${readSummary(outcome)}; the time ran out before the list ended`
      }, evidence);
    }
    return deps.success(action, startedAt, "List extracted.", validationFor(outcome, minItems, expected), evidence);
  } catch (error) {
    return deps.failure(action, error, startedAt);
  }
}

/** The request's minimum, or 1 when it names none: a list that matched nothing is not a success unless the author said so. */
function minimumItems(requested: number | undefined): number {
  return typeof requested === "number" && Number.isFinite(requested) ? Math.max(0, Math.trunc(requested)) : 1;
}

/** The declared field keys, in declaration order, with every `handling: "exclude"` field left out (D12). */
function includedFieldNames(request: WebAutomationExtractListRequest): string[] {
  return Object.entries(request.fields)
    .filter(([, field]) => typeof field === "string" || field?.handling !== "exclude")
    .map(([name]) => name);
}

/**
 * The read's account of itself: counts, a flag and declared field keys, and
 * nothing read off the page but each condition's bounded `seen` value.
 *
 * `itemsSeen` and `emptyRecords` are the two counts a zero read is diagnosed by,
 * and they are sent only when the page counted them, because the domain's copy
 * treats them as optional precisely so an older extension build still sends a
 * summary that arrives whole (`domain/src/actions/extraction/summary.ts`).
 *
 * **`listWait` is the third, and it is a field rather than a phrase because a
 * phrase cannot be counted.** The wait's account has been in the comparison text
 * since the wait was fixed, and that reads well and tallies to nothing: the
 * regression it describes was found by arithmetic on `durationMs` across ten
 * bundles, and a scan looking for `stoppedOn: "page_settled"` beside
 * `recordCount: 0` has to group by a field. The presence is not repeated inside
 * it -- `listPresence` is that fact, and two copies of one fact can disagree.
 */
function summaryOf(outcome: Outcome, fieldNames: readonly string[]): ExtractionSummary {
  return {
    recordCount: outcome.records.length,
    pagesRead: outcome.pagesRead,
    truncated: outcome.truncated,
    missingFields: [...outcome.missingFields],
    fieldNames: [...fieldNames],
    ...(outcome.itemsSeen === undefined ? {} : { itemsSeen: outcome.itemsSeen }),
    ...(outcome.emptyRecords === undefined ? {} : { emptyRecords: outcome.emptyRecords }),
    ...(outcome.listPresence ? { listPresence: outcome.listPresence } : {}),
    ...(outcome.listWait ? { listWait: { stoppedOn: outcome.listWait.stoppedOn, waitedMs: outcome.listWait.waitedMs, waitedFor: outcome.listWait.waitedFor } } : {}),
    // `seen` is the one page value here, one per condition and cut to 60 characters (`extraction/item-filter.ts`).
    ...(outcome.conditions ? { conditions: { ...outcome.conditions, rejected: [...outcome.conditions.rejected], ...(outcome.conditions.seen ? { seen: [...outcome.conditions.seen] } : {}) } } : {}),
    // Only beside the counts they illustrate, and only for a read asked for them.
    ...(outcome.conditions && outcome.rejectedSamples ? { rejectedSamples: outcome.rejectedSamples.map((rows) => rows.map((row) => ({ ...row }))) } : {}),
    ...(outcome.paginationStop ? { paginationStop: outcome.paginationStop } : {}),
    // What dedupe and sort took -- the repeats left out and the rows a sort key
    // could not read -- so a sort over a column the page states as prose is
    // visible to the verifier rather than looking like page order.
    ...(outcome.order ? { order: { duplicates: outcome.order.duplicates, unsortable: outcome.order.unsortable } } : {})
  };
}

/**
 * Whether the post-condition held, and the phrase that says why.
 *
 * **A column some rows had nothing in is not a shortfall.** Only a field the
 * author wrote `required: true` on is, and `outcome.missingFields` is that list
 * (`extraction/field-spec.ts`). Until 2026-09-26 the string grammar asserted
 * `required` for every field, so a page where three cards of forty-three carried
 * no rating failed here -- `output_not_observed`, a failed node, nothing stored
 * where forty good rows existed. A default that turns a wide answer into an empty
 * one is the shape this product does not take.
 *
 * **What replaces the failure is a stated gap**, and it is stated whether the
 * read passed or failed, because a read that answers with forty rows and says
 * nothing about the three that are short reads as complete. `blankFields` names
 * the columns and `incompleteRecords` counts the rows, so the answer is wide,
 * visibly imperfect, and repairable -- which is what the loop converges on.
 */
function validationFor(outcome: Outcome, minItems: number, expected: string): BrowserActionValidation {
  const gap = recordGap(outcome);
  if (outcome.records.length >= minItems && outcome.missingFields.length === 0) {
    return { status: "passed", expected, actual: `${readSummary(outcome)}; ${gap ?? "every declared field present"}` };
  }
  const shortfalls = [
    ...(outcome.records.length < minItems ? [`fewer than the ${minItems} required`] : []),
    ...(outcome.missingFields.length > 0 ? [`required fields missing from some records: ${outcome.missingFields.join(", ")}`] : []),
    ...(gap ? [gap] : [])
  ];
  return { status: "failed", expected, actual: `${readSummary(outcome)}; ${shortfalls.join("; ")}` };
}

/**
 * The columns some returned rows had nothing in, and how many rows those were,
 * or nothing at all for a read whose every row is whole. Field keys and counts
 * only: no page text.
 */
function recordGap(outcome: Outcome): string | undefined {
  const blank = outcome.blankFields ?? [];
  const incomplete = outcome.incompleteRecords ?? 0;
  if (blank.length === 0 && incomplete === 0) return undefined;
  const rows = `${count(incomplete, "record")} short of a declared field`;
  const empty = outcome.emptyRecords ?? 0;
  const whole = empty > 0 && empty === outcome.records.length && outcome.records.length > 0
    ? ", and every returned record is empty, so the fields were read off the wrong element"
    : "";
  return blank.length === 0 ? `${rows}${whole}` : `${rows}, blank in ${blank.join(", ")}${whole}`;
}

/**
 * What the read did, in one phrase. The items a `where` condition left out are
 * said as well as the records kept: a read that answered with sixteen rows
 * because four of the twenty items on the page were advertisements has done
 * something different from one that found sixteen items, and the number of rows
 * alone cannot tell the two apart.
 *
 * **A read whose `item` selector named nothing says so first**, because a read
 * of zero records reads exactly like a page that held nothing, and the two want
 * different repairs: one changes the selector, the other the instruction.
 * Nothing else in the phrase can say which happened, and the wait that would
 * have found the list has already given up by the time this is written
 * (`extraction/page-render.ts`). It is said and the read still succeeds: an
 * empty page is a legitimate answer, so this adds a fact rather than a verdict.
 *
 * **And it says what the wait for the list did**, because "no records" with no
 * account of the waiting is a duration to be interpreted rather than a fact to
 * be read. On 2026-09-25 a wait that ended on two seconds of page stillness
 * turned four live reads into zero-record answers on pages whose lists were
 * four to eight seconds away, and establishing that from the bundles took a day
 * of matching durations against constants, because the only thing published
 * about the wait was that it had happened. So the phrase names how many items
 * were waited for, how long it took, and which of four things ended it
 * (`ListWait`). The same three facts are declared on the wire summary as
 * `listWait` (`domain/src/actions/extraction/summary.ts`) and the two are not
 * redundant: the field is what a scan over a run's bundles can group by, and the
 * phrase is what a model reading one failure's evidence actually reads, since
 * `client/gateway-mapping.ts` carries the comparison text as "the only place the
 * evidence for a failure lives". `summaryOf` sends the field; this says it in
 * words, and both are built from the same `ListWait`, so they cannot disagree.
 *
 * **A read whose conditions kept nothing says so next**, because that is the
 * one thing about such a read worth reading. It answers with the rows they rejected
 * rather than with none (`extraction/list-reader.ts`), so without the phrase the
 * result would look like a plain unfiltered read that happened to match
 * everything -- and on 2026-09-24 the empty version of the same mistake cost a
 * whole run before anyone could see which of two things had gone wrong
 * (`run-mug3tnti-9ab80b85`).
 */
function readSummary(outcome: Outcome): string {
  const read = `${count(outcome.records.length, "record")} from ${count(outcome.pagesRead, "page")}${outcome.truncated ? ", truncated" : ""}${faultAccount(outcome)}${pagingAccount(outcome)}`;
  if (outcome.listPresence === "never_appeared") {
    return `${read}; the item selector named nothing on the page, so the list never appeared${waitAccount(outcome.listWait)} -- change the selector rather than the fields or the conditions`;
  }
  const report = outcome.conditions;
  if (report?.unfiltered) {
    return `${read}, but where kept none of the ${count(report.applied, "item")} it was applied to, so the rows it rejected were returned unfiltered${culprits(report)} -- narrow the conditions rather than trusting these rows`;
  }
  return `${read}${outcome.filtered > 0 ? `, ${count(outcome.filtered, "item")} left out by where` : ""}`;
}

/**
 * What the read could not get, for a read the page faulted under.
 *
 * It says the shortfall rather than hiding it, and that is the whole point of
 * absorbing the fault at all: a read that skipped four rows because the page
 * recycled them, or that stopped after three pages because the next control
 * threw, is answering with less than it was asked for, and an answer that does
 * not say so is worse than a failure. The rows it *did* get are still returned
 * (`extraction/list-reader.ts`), which is what this repository's worst failures
 * did not do -- one detached node used to discard forty good rows.
 *
 * Nothing is said for a read that faulted nowhere, so a clean read's phrase is
 * unchanged.
 */
function faultAccount(outcome: Outcome): string {
  const items = outcome.itemFaults ?? 0;
  // A refused page the read waited out and reloaded is recovered, and still
  // said: the recovery is a fact about the site. One it stopped on is said by
  // `pagingAccount` instead.
  const retries = outcome.refusedStatus === undefined ? outcome.pageRetries ?? 0 : 0;
  const parts = [
    ...(items > 0 ? [`${count(items, "item")} could not be read and were skipped`] : []),
    ...(outcome.pageFault ? ["the move to the next page failed, so the read ends with the pages it has"] : []),
    ...(retries > 0 ? [`the server refused a page and the read waited and reloaded it (${count(retries, "time")}) and went on`] : [])
  ];
  return parts.length === 0 ? "" : `, and ${parts.join(", and ")}`;
}

/**
 * Why a read that pages stopped paging, in words, so the model reading one
 * result can act on it without knowing the closed set -- and the same word is
 * on the summary as `paginationStop` for a scan to group by. Nothing for a read
 * that did not page, so an unpaginated read's phrase is unchanged.
 *
 * **The list ending in the ordinary way is not said.** A pager that ran out, a
 * disabled last Next, a feed scrolled to its bottom: that is the read doing
 * what was asked, and the word on the summary is enough. The deadline is not
 * said either, because a timed-out read already says the time ran out. What is
 * said is every stop a Flow can do something about.
 *
 * `control_absent` on page one is said as what it most often is, a control
 * selector that names nothing, because a request that asked to page and read
 * one page with no control in sight is far likelier to be pointing at the wrong
 * element than at a list of one page.
 */
function pagingAccount(outcome: Outcome): string {
  const stop = outcome.paginationStop;
  if (stop === undefined) return "";
  const refused = outcome.refusedStatus;
  if (refused !== undefined) {
    const answer = refused === 429 ? "429, too many requests" : `${refused}, unavailable`;
    const retried = (outcome.pageRetries ?? 0) > 0 ? ` and went on refusing after the read waited and reloaded it (${count(outcome.pageRetries ?? 0, "time")})` : "";
    return `; paging stopped because the server refused the next page (HTTP ${answer})${retried} -- the list goes on past these records, so the read is incomplete`;
  }
  const firstPageMiss = stop === "control_absent" && outcome.pagesRead <= 1;
  if (!firstPageMiss && (ORDINARY_END.has(stop) || stop === "deadline" || (stop === "page_fault" && outcome.pageFault))) return "";
  if (firstPageMiss) {
    return "; paging stopped on the first page because the pagination control named nothing there -- check the control's selector, unless the list has only one page";
  }
  return `; paging stopped because ${PAGING_STOPPED[stop]}`;
}

/** The stops that are the list ending as lists end, which the phrase leaves to the summary's word. */
const ORDINARY_END: ReadonlySet<NonNullable<Outcome["paginationStop"]>> = new Set(["control_absent", "control_disabled", "no_following_page", "scrolled_to_end"]);

// `rate_limited` is named ahead of the domain's closed set admitting it
// (`extraction/pagination.ts`, `RATE_LIMITED_STOP`), so the phrase is ready the
// day the word is sent.
const PAGING_STOPPED: Record<NonNullable<Outcome["paginationStop"]> | "rate_limited", string> = {
  control_absent: "the pagination control was no longer on the page, which is the list ending",
  control_disabled: "the pagination control was disabled, which is the list ending",
  no_following_page: "the pager showed no page after the current one, which is the list ending",
  scrolled_to_end: "scrolling to the bottom brought nothing new, which is the list ending",
  list_vanished: "the page the control led to showed none of the list and no way on -- a rate limit, a check page or an error, not the list ending -- so the read is incomplete",
  rate_limited: "the server kept refusing the next page as too many requests -- the list goes on past these records, so the read is incomplete",
  page_limit: "the page bound (maxPages, or maxScrolls for a scroll read) was reached while the list went on -- raise it to read more",
  item_limit: "maxItems was reached while the list went on -- raise it to read more",
  deadline: "the command's timeout ran out",
  list_unchanged: "the page ignored its pagination control: pressing it, and going to the address it links to, left the list unchanged",
  page_repeated: "the page the control led to held only records earlier pages already had, so the control leads back rather than on",
  control_not_clickable: "the pagination control is not an element that can be pressed",
  page_fault: "the move to the next page failed"
};

/** What ended the wait for the list, in words, so no reader has to know a constant to read the phrase. */
const STOPPED_ON: Record<NonNullable<Outcome["listWait"]>["stoppedOn"], string> = {
  list_present: "the list arriving",
  page_settled: "the page holding still with the list already part drawn",
  window_elapsed: "the read's own render window running out",
  deadline_passed: "the command's timeout running out"
};

/**
 * How long the read waited for the list, for how many items, and what ended the
 * wait. Absent for a continued read, which waits for its predecessor's page
 * rather than for a list and has no such account to give.
 */
function waitAccount(wait: Outcome["listWait"]): string {
  if (!wait) return "";
  return `, after waiting ${wait.waitedMs}ms for ${count(wait.waitedFor, "item")} and stopping on ${STOPPED_ON[wait.stoppedOn]}`;
}

/**
 * The conditions that rejected every item they were asked about, named by their
 * position in `where`. One of them is what emptied the read, and saying which
 * is the difference between a repair that can act and a repair that guesses
 * among four conditions. Nothing is said when every condition rejected only
 * some items and it was their combination that left nothing.
 */
function culprits(report: NonNullable<Outcome["conditions"]>): string {
  const all = report.rejected.flatMap((rejected, index) => (report.applied > 0 && rejected === report.applied ? [index] : []));
  if (all.length === 0) return "; no one condition rejected them all, so it was the conditions together";
  return `; ${all.map((index) => `where[${index}]`).join(" and ")} rejected every one`;
}

function count(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}
