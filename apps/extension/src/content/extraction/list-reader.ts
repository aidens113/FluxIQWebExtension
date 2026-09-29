// Reading a repeating structure into records: the page half of
// `web.dom.extract_list`.
//
// `item` selects each record's root, `where` says which of those items are
// records at all (`item-filter.ts`), and `fields` maps a record field key to
// what is read inside it: `field-spec.ts` normalizes each field and
// `field-reader.ts` reads it. Every field is normalized before anything on the
// page is read, so an excluded field is never read (decision D12), and an
// `encrypt` field or a field the page cannot honour refuses the read before it
// starts. With `paginate`, the read goes on page by page through
// `pagination.ts`, which stops at the list's end, the mode's bound, or the
// command's deadline.
//
// The page a read starts on is waited for in three steps that ask different
// questions. `page-render.ts` asks whether the list is *there* -- drawn, and no
// longer arriving on its own. `list-wait.ts` asks whether it is *all* there, by
// revealing the end of the list and seeing what that brings, because a page
// that loads its last results on scroll is stable, unfinished and
// indistinguishable from a finished one until something scrolls. Only then is
// the request's own `minItems` asked for. A read that pages asks only the
// first, for its first item: it reaches the rest of the list by its own
// mechanism.
//
// An item already read is not read again, so a page that appends its next
// items rather than replacing them yields each item once. In `scroll` mode an
// item is its element and its content together (decision D16): a virtualised
// list that recycles a node for a new record still yields that record, while a
// node showing what it showed when read is skipped. `maxItems` bounds the
// result, and the domain's `WEB_AUTOMATION_EXTRACT_MAX_ITEMS` bounds it when the
// request names no bound.
//
// The two modes that move to another page -- `next` and `numbered` -- also
// leave out a record that repeats one an earlier page already yielded, field
// for field. An element cannot say that: a page replaced in place, or loaded
// as a new document, shows only new elements, so the listing a search's index
// shifted onto the top of the next page would otherwise be read twice, and
// only when the page happened to be replaced rather than reloaded. Two equal
// records on the same page are still two records, as the page shows them.
//
// A read can outlive its document. With a `checkpoint`, the records and pages
// read so far, and the item count its account is built from, are handed over,
// and awaited, before each control is followed;
// with `resume`, a new document goes on from such a checkpoint -- its records
// count toward the bound, its pages toward `maxPages`, its items toward
// `itemsSeen`, and in every mode none of its records is read again, since a new
// document can only show them as new elements -- after waiting for the page to
// show its records (`page-render.ts`). The worker's side of that is
// `runtime/extract-list-continuation.ts`.
//
// An item a `where` condition rejects is not a record and never becomes one:
// it is left out of the records, it does not count toward `maxItems`, and a
// required field it lacks is not reported missing, because the request never
// asked to read it. `filtered` counts them, so a read says how much of the run
// it left out rather than only how much it kept.
//
// **Unless the conditions left nothing at all, in which case the read answers
// with the rows it rejected and says so** (`conditions.unfiltered`). That is a
// deliberate preference for too much over nothing, and it was bought with a
// measurement: on 2026-09-24 `run-mug3tnti-9ab80b85` returned 0 records where 13
// were wanted, because conditions a newly sharper vocabulary made writable
// rejected every row, and an empty table is indistinguishable from a page that
// had nothing on it. A superset is visibly too wide and the loop's own judgement
// can say so; nothing is a plausible-looking answer that ends the loop.
//
// So the rejected rows are kept as they are read -- the record is built before
// the conditions are asked, so this costs an array rather than a second pass --
// and `conditions` reports what happened in counts alone: how many items the
// conditions were applied to, how many survived, how many each condition
// rejected, and whether the read fell back. A model that gets thirty rows and
// "condition 2 rejected all thirty" can repair condition 2; a model that gets
// nothing cannot repair anything.
//
// A record carries every included field: its value, or `null` for an optional
// field the page could not read. `missingFields` names every required field
// some record lacked, which is what makes the verb's validation fail instead of
// silently returning blanks.
//
// **Almost nothing is required any more, and the gap is stated instead.** A
// field is required only where the author wrote `required: true`
// (`field-spec.ts`), because until 2026-09-26 the string grammar asserted it for
// every field and three ratingless cards of forty-three therefore failed the
// whole read and stored nothing. What replaces the failure is an account: the
// records come back with `null` in the cells the page had nothing for,
// `blankFields` names those columns, `incompleteRecords` counts the rows that
// are short, and `emptyRecords` counts the rows that yielded nothing at all --
// which is the reading of a page whose columns were all read off the wrong
// element, a renamed `column:` header included. `itemsSeen` sits beside them and
// says how many items the selector named, so a zero is attributable: no items,
// items the conditions removed, or items whose every field came back empty.
//
// Three conditions are not "the page differs" but "the request cannot be
// performed", so they throw and become a failed result: a `column` field on
// items that are not table rows, a pagination control followed without the
// list ever changing, and a field that resolved to a sensitive control or to
// an element inside one. The last carries an ACTION_REJECTED record, so the
// whole read is refused (decision D2).
//
// Running out of the command's `timeoutMs` is neither: the read stops, and the
// outcome says `timedOut` with the records and pages it did read (decision D5).
// Without a `timeoutMs` the read is bounded by the mode's bound and the wait
// for each page.
//
// **`dedupe` and `sort` come between `where` and `maxItems`** (`order-rows.ts`).
// A kept row that repeats an earlier one under the request's `dedupe` columns
// is left out as it is read, so it never takes a place under the bound, and is
// counted. A request that sorts reads every row up to the domain's record bound
// rather than stopping at `maxItems`, because "the five newest" has to see
// every row before it can say which five; the answer is sorted and only then
// cut, and `truncated` says it was. `order` reports both counts, including the
// rows a sort key could not read, which go last.

import { WEB_AUTOMATION_EXTRACT_MAX_ITEMS } from "@fluxiq-web-extension/domain/client";
import type { ExtractionCheckpoint } from "../../shared/extraction-continuation";
import type { WebAutomationExtractListPagination, WebAutomationExtractListRequest } from "../types";
import { readField } from "./field-reader";
import { normalizeExtractField, type ExtractFieldReader } from "./field-spec";
import { filteredListAnswer, type ListExtractionConditionReport } from "./filtered-answer";
import { itemFilterFor } from "./item-filter";
import { awaitListComplete } from "./list-wait";
import { listRowOrderFor, type ListExtractionOrderReport } from "./order-rows";
import { awaitListPresent, awaitPageRendered, type ListPresence, type ListWait } from "./page-render";
import { advancePage, deadlineFor, paginationStopOf, type PaginationProgress, type PaginationStop } from "./pagination";

/** One record: each included field's value, or `null` for an optional field the page could not read. */
export type ExtractedListRecord = Record<string, string | null>;

export type ListExtractionOutcome = {
  records: ExtractedListRecord[];
  /** Pages actually read, the first included. */
  pagesRead: number;
  /** Whether `maxItems` or the pagination's bound stopped the read before the list ended. */
  truncated: boolean;
  /** Whether the command's `timeoutMs` ran out before the list ended. */
  timedOut: boolean;
  /**
   * Items the read could not read at all, because reading them threw.
   *
   * A virtualized list recycles its rows while it is being read, and a page that
   * re-renders under a paginated read detaches the elements a field reader is
   * holding. Until 2026-09-26 one such throw ended the whole read: the loop had
   * no catch, `actions/extract-list.ts` reported `deps.failure`, and **every row
   * already read was discarded** -- the total-instead-of-partial failure this
   * repository has paid for repeatedly. The item is skipped and counted instead,
   * and the count is what stops the skip being silent.
   *
   * Absent for a read that skipped nothing, so the two are different facts.
   */
  itemFaults?: number | undefined;
  /**
   * Whether moving to the next page threw, which ends the read with the pages it
   * already has rather than with nothing.
   *
   * It is not `truncated` and not `timedOut`: no cap was reached and no time ran
   * out, so overloading either would make a count a reader groups by say
   * something the read did not do.
   */
  pageFault?: boolean | undefined;
  /** Whether the page ever showed the list at all (C2): `"never_appeared"` for a read whose `item` selector named nothing, and absent for a continued read, which waits for its predecessor's page rather than for a list. */
  listPresence?: ListPresence | undefined;
  /** What the wait for the list did, for a read that has to say why it found none: what it waited for, how long, and what ended it. Absent wherever `listPresence` is. */
  listWait?: ListWait | undefined;
  /** Required fields that at least one record did not yield, which is what fails the verb's post-condition. */
  missingFields: string[];
  /**
   * Items the `item` selector named, across every page and every document read,
   * before any condition, any duplicate and the item bound -- the count that
   * separates a selector which matched nothing from a page the conditions
   * emptied.
   *
   * It is the whole read's count, never one document's, because `recordCount` and
   * `pagesRead` beside it are the whole read's and a reader comparing them against
   * the last document alone would conclude the selector matched fewer items than
   * it did. A continued read therefore adds its own document's items to the count
   * its predecessor checkpointed.
   *
   * Absent only where it is genuinely unknown: a continuation resumed from a
   * checkpoint written by a page build that did not count items has no beginning
   * to add to, and says nothing rather than reporting its own document's items as
   * the read's.
   */
  itemsSeen?: number | undefined;
  /**
   * Fields at least one returned record carries as `null`: a column the page had
   * nowhere to read for some of its rows.
   *
   * A fact, never a failure. An optional field the page could not read is `null`
   * in its record (D16) and fails nothing, which is what keeps three ratingless
   * cards from destroying forty good rows -- and which would otherwise leave the
   * gap unsaid. `missingFields` cannot carry it: that list is the *required*
   * fields, and it is the one that fails the read.
   */
  blankFields?: string[] | undefined;
  /** Returned records short of at least one declared field, whether `null` or absent. A stated gap, never a failure. */
  incompleteRecords?: number | undefined;
  /** Returned records that yielded no declared field at all: the read found rows and every field read off the wrong element. */
  emptyRecords?: number | undefined;
  /** Items of the run that a `where` condition left out, so they are not records (C5). */
  filtered: number;
  /** What the request's conditions did, in counts alone, or absent for a request that named none. */
  conditions?: ListExtractionConditionReport | undefined;
  /**
   * Why a read that pages stopped paging, or absent for a read that did not page.
   *
   * `truncated`, `timedOut` and `pageFault` each say one way a read can stop,
   * and none of them says the ordinary ones: a `next` control that named
   * nothing, one that was disabled, a page that came back as the page before.
   * Live run `run-mulwm2dc-0bd95f22` stopped on page one of fifty with all three
   * false-or-absent and nothing else to go on. Every exit of a paginated read
   * sets exactly one word (`pagination.ts` for the moves, this file for
   * `item_limit`, `page_repeated` and `list_vanished`).
   */
  paginationStop?: PaginationStop | undefined;
  /** What `dedupe` and `sort` did, in counts alone, or absent for a request that named neither. */
  order?: ListExtractionOrderReport | undefined;
};

/**
 * What the command adds to the request: how long the whole read may take, and,
 * when the worker carries the read across documents, where it goes on from and
 * where it hands its progress.
 */
export type ListExtractionOptions = {
  timeoutMs?: number | undefined;
  /** The read another document began, which this one continues. */
  resume?: ExtractionCheckpoint | undefined;
  /** Takes the read so far before each control is followed; the control is followed once it resolves. */
  checkpoint?: ((progress: ExtractionCheckpoint) => Promise<void>) | undefined;
};

type FieldReaders = ReadonlyArray<readonly [name: string, reader: ExtractFieldReader]>;

/** One item read: its record, and the required fields it lacked. */
type ItemRead = { record: ExtractedListRecord; missing: string[] };

export async function extractList(request: WebAutomationExtractListRequest, options: ListExtractionOptions = {}): Promise<ListExtractionOutcome> {
  const item = request.item.trim();
  if (!item) throw new Error("An extract_list request needs an item selector.");
  const fields = fieldReaders(request.fields);
  // Before anything on the page is read, as every field is: a condition the
  // page cannot honour refuses the read rather than emptying a list midway.
  const rejects = itemFilterFor(request);
  const paginate = request.paginate;
  const maxItems = itemBound(request.maxItems);
  // `dedupe` and `sort`, over the columns the read reads. A sort is over every
  // row read, so `maxItems` bounds its answer, and the read itself is bounded
  // only by the domain's record bound.
  const order = listRowOrderFor(request, fields.map(([name]) => name));
  const readBound = order?.sorts ? WEB_AUTOMATION_EXTRACT_MAX_ITEMS : maxItems;
  const contentAware = paginate?.mode === "scroll";
  const resume = options.resume;

  const records: ExtractedListRecord[] = resume ? resume.records.map((record) => ({ ...record })) : [];
  // Every dedupe identity a kept row already has, the carried rows' included,
  // and how many kept rows this document left out for repeating one.
  const identities = new Set<string>(order === undefined ? [] : records.flatMap((record) => order.identity(record) ?? []));
  let duplicates = 0;
  const missing = new Set<string>(resume?.missingFields ?? []);
  // The rows the conditions rejected, kept only so a read the conditions emptied
  // has something to answer with. They are bounded and deduplicated exactly as
  // the records are, and a read that kept anything at all never looks at them.
  const rejectedRows = rejects === undefined ? undefined : {
    records: [] as ExtractedListRecord[],
    missing: new Set<string>(),
    seen: new Set<string>(),
    truncated: false
  };
  // Every item already read, kept across pages, with its content key when
  // content counts (scroll mode) and "" when only the element does.
  const read = new Map<Element, string>();
  // The content of every record that must not be read again: each record an
  // earlier page yielded, in the modes that move to another page, and in every
  // mode each record a continued read carried here from another document.
  const pageByPage = movesToAnotherPage(paginate);
  const earlierPages = pageByPage || resume ? new Set(records.map((record) => contentKey(record, fields))) : undefined;
  const keyOf = (itemRead: ItemRead): string => (contentAware ? contentKey(itemRead.record, fields) : "");
  const hasUnreadItem = (): boolean => Array.from(document.querySelectorAll(item)).some((element) => {
    const seen = read.get(element);
    return seen === undefined || (contentAware && seen !== keyOf(readRecord(element, fields)));
  });
  const progress: PaginationProgress = {
    item,
    shown: [],
    pagesRead: resume?.pagesRead ?? 0,
    scrolls: resume?.scrolls ?? 0,
    deadline: deadlineFor(options.timeoutMs),
    hasUnreadItem
  };
  const checkpoint = options.checkpoint;
  if (checkpoint) {
    progress.beforeFollow = () => {
      // `itemsSeen` is the whole read's count so far, so the document this control
      // loads goes on adding to it rather than starting over. Left out where this
      // read could not know it, which is the one thing an absent count may mean.
      const seen = itemsSeen();
      return checkpoint({
        records: records.map((record) => ({ ...record })),
        pagesRead: progress.pagesRead,
        scrolls: progress.scrolls,
        missingFields: [...missing].sort(),
        filtered,
        ...(seen === undefined ? {} : { itemsSeen: seen })
      });
    };
  }
  let truncated = false;
  let timedOut = false;
  let paginationStop: PaginationStop | undefined;
  // In the modes that move to another page: the content of every item any
  // earlier page showed, kept or not, so a page that shows nothing else is known
  // for the repeat it is. A continued read starts from the records it carried,
  // which is all its checkpoint holds.
  const shownOnEarlierPages = pageByPage ? new Set(records.map((record) => contentKey(record, fields))) : undefined;
  // Items reading threw on, and whether the move to the next page did. Both are
  // absorbed rather than raised: the rows already read are the answer, and an
  // answer that is too small is worth more than no answer at all.
  const faultedItems = new Set<Element>();
  let pageFault = false;
  // "Your item selector names nothing" and "the page holds nothing" are
  // different repairs, and a read of zero records cannot tell them apart (C2).
  let listPresence: ListPresence | undefined;
  // And neither can it say, of the first, whether it waited for the list at all.
  let listWait: ListWait | undefined;
  let filtered = resume?.filtered ?? 0;
  // Items the conditions were asked about in this document, and how many of
  // them each condition rejected. A continued read carries its predecessor's
  // `filtered` and not its rejected rows, so these counts say what this
  // document did and `filtered` says what the whole read did.
  let applied = 0;
  let kept = 0;
  const rejectedEach = (request.where ?? []).map(() => 0);

  // Items the selector named, counted once each, whichever page or scroll named
  // them: a set rather than a running sum, because a `loadMore` or `scroll` read
  // re-queries the same document and would otherwise count its first items again
  // on every pass. Counted before the bound and before any condition, so the
  // number says what the page held rather than what the read kept.
  //
  // The set can only hold this document's elements, so a continued read adds
  // what its predecessor counted. `undefined` is a checkpoint from a page build
  // that counted nothing: there is no beginning to add to, so the read says
  // nothing rather than reporting one document's items as the whole read's, and
  // that absence travels on to the next document in place of a number that would
  // be missing its start.
  const namedItems = new Set<Element>();
  const itemsSeenBefore = resume === undefined ? 0 : resume.itemsSeen;
  const itemsSeen = (): number | undefined => (itemsSeenBefore === undefined ? undefined : itemsSeenBefore + namedItems.size);

  /** The read as it stands, with `filtered-answer.ts` deciding which rows it answers with. */
  const outcome = (ended: { timedOut: boolean }): ListExtractionOutcome => {
    const answer = filteredListAnswer({
      kept: records,
      keptMissing: missing,
      rejected: rejectedRows?.records ?? [],
      rejectedMissing: rejectedRows?.missing ?? new Set(),
      rejectedTruncated: rejectedRows?.truncated ?? false
    }, truncated);
    // Then dedupe, sort and the bound, over whichever rows the answer is. For
    // kept rows the dedupe is already done and finds nothing more; for the rows
    // a read the conditions emptied falls back to, it is the whole of it.
    const ordered = order?.apply(answer.records, maxItems);
    const answered = ordered?.rows ?? answer.records;
    const seen = itemsSeen();
    return {
      records: answered,
      pagesRead: progress.pagesRead,
      truncated: answer.truncated || (ordered?.cut ?? false),
      timedOut: ended.timedOut,
      missingFields: answer.missingFields,
      filtered,
      ...recordGaps(answered, fields),
      ...(seen === undefined ? {} : { itemsSeen: seen }),
      ...(faultedItems.size === 0 ? {} : { itemFaults: faultedItems.size }),
      ...(pageFault ? { pageFault: true } : {}),
      ...(listPresence === undefined ? {} : { listPresence }),
      ...(listWait === undefined ? {} : { listWait }),
      ...(rejects === undefined ? {} : { conditions: { applied, kept, rejected: [...rejectedEach], unfiltered: answer.unfiltered } }),
      ...(paginate === undefined || paginationStop === undefined ? {} : { paginationStop }),
      ...(ordered === undefined ? {} : { order: { duplicates: duplicates + ordered.duplicates, unsortable: ordered.unsortable } })
    };
  };

  // A document continuing a read was reached by the control the last one
  // followed, so it is waited on as that control's page would have been.
  if (resume && paginate && await awaitPageRendered(paginate, progress) === "timed_out") {
    paginationStop = "deadline";
    return outcome({ timedOut: true });
  }
  // The page this read starts on gets the same wait as every page it moves to
  // (`page-render.ts`): a read dispatched at a page still rendering its list
  // used to read the empty one and report it as a clean read of nothing. It is
  // a ceiling, not a sleep -- a page that already holds its items is read at
  // once -- and what it waits for is what the request said the page must hold.
  if (!resume) {
    // Three waits, in this order, and the order is the point. First the list is
    // there and has stopped arriving on its own -- a paginated read waits only
    // for its first item, since the rest may legitimately be on a later page
    // and `pagination.ts` waits for each of those. Then, for a read of one
    // page, the end of the list is revealed until nothing more comes
    // (`list-wait.ts`): the results a page loads only once its bottom is
    // scrolled to are the rest of this page, not another one, and no live Flow
    // has ever carried a scroll node before its extraction. Only then is the
    // request's own minimum waited for, because before the reveal a page that
    // is one scroll from holding sixteen items holds twelve, and waiting there
    // spends the whole command on a sixteenth that was never going to come.
    const required = requiredItems(request.minItems);
    listWait = await awaitListPresent(item, 1, paginate === undefined, progress);
    listPresence = listWait.presence;
    if (paginate === undefined) {
      // `maxItems` bounds records rather than items, so only a read with no
      // condition can tell from the page that it has already seen every item it
      // could keep -- which is how the picker's five-row preview is read
      // without scrolling the page a person is looking at.
      // Nor can a read that dedupes or sorts: a duplicate takes no place under
      // the bound, and a sort has to see every row.
      await awaitListComplete(item, rejects || order ? Number.MAX_SAFE_INTEGER : maxItems, progress.deadline);
      if (required > 1) {
        // Two waits on one page, reported as one: the second's answer, and both
        // their time, so the account's `waitedMs` is what the read actually
        // spent looking for this list rather than the last leg of it.
        const again = await awaitListPresent(item, required, false, progress);
        listWait = { ...again, waitedMs: listWait.waitedMs + again.waitedMs };
        listPresence = again.presence;
      }
    }
  }

  for (;;) {
    const shown = Array.from(document.querySelectorAll(item));
    // A list no wait saw but the read does -- a later page's, or one drawn between the two -- still appeared.
    if (listPresence === "never_appeared" && shown.length > 0) {
      listPresence = "appeared";
      // The account has to agree with the field taken from it, and what ended
      // the wait is unchanged by the list turning up after it.
      if (listWait !== undefined) listWait = { ...listWait, presence: "appeared" };
    }
    progress.shown = shown;
    progress.pagesRead += 1;
    for (const element of shown) namedItems.add(element);
    const thisPage: string[] = [];
    // Every item this page showed that was read, by content, for the repeat check below.
    const shownThisPage: string[] = [];
    for (const element of shown) {
      // Reading one item is where the page can fail under the read: a
      // virtualized list recycles the row a field reader is holding, and a
      // re-render detaches it. The item is skipped and counted; the rows already
      // read are still the answer. A row that faulted is remembered so a
      // re-queried document does not fault on it again and again.
      if (faultedItems.has(element)) continue;
      try {
        const seen = read.get(element);
        if (seen !== undefined && !contentAware) continue;
        // A new element past the bound is not read at all; a recycled one is
        // read first, because only its content says whether it is a new record.
        if (seen === undefined && records.length >= readBound) {
          truncated = true;
          break;
        }
        const itemRead = readRecord(element, fields);
        const key = keyOf(itemRead);
        if (seen === key) continue;
        if (shownOnEarlierPages) shownThisPage.push(contentKey(itemRead.record, fields));
        // An item a condition rejects is not a record: it is remembered as read
        // so a growing list still knows it has been looked at. It is kept aside
        // only so a read the conditions emptied has something to answer with,
        // and a read that kept anything never returns it.
        if (rejects) {
          const rejectedBy = rejects(element, itemRead.record);
          if (seen === undefined) applied += 1;
          if (rejectedBy.length > 0) {
            if (seen === undefined) {
              filtered += 1;
              // Each index is a position in `where`, which is what `rejectedEach`
              // was sized from, so the fallback is for the compiler rather than
              // for a case that happens.
              for (const index of rejectedBy) rejectedEach[index] = (rejectedEach[index] ?? 0) + 1;
              rememberRejected(rejectedRows, itemRead, fields, earlierPages !== undefined, order ? WEB_AUTOMATION_EXTRACT_MAX_ITEMS : maxItems);
            }
            read.set(element, key);
            continue;
          }
          if (seen === undefined) kept += 1;
        }
        const content = earlierPages ? contentKey(itemRead.record, fields) : "";
        if (earlierPages?.has(content)) {
          read.set(element, key);
          continue;
        }
        // After `where`, before the bound: a repeat of a kept row is not a row.
        const identity = order?.identity(itemRead.record);
        if (identity !== undefined && identities.has(identity)) {
          duplicates += 1;
          read.set(element, key);
          continue;
        }
        if (records.length >= readBound) {
          truncated = true;
          break;
        }
        read.set(element, key);
        if (identity !== undefined) identities.add(identity);
        records.push(itemRead.record);
        thisPage.push(content);
        for (const name of itemRead.missing) missing.add(name);
      } catch (error) {
        // A refusal is not a fault the page caused: a field that resolved to a
        // sensitive control refuses the whole read (decision D2), and an
        // `encrypt` field refuses it until the column is built. Both carry a
        // failure record, and absorbing them as a skipped item would return the
        // rows around a secret as a successful read.
        if (isRefusal(error)) throw error;
        faultedItems.add(element);
      }
    }
    if (pageByPage) for (const content of thisPage) earlierPages?.add(content);
    if (truncated || !paginate) {
      if (truncated && paginate) paginationStop = "item_limit";
      break;
    }
    // A page reached by a control that shows only what earlier pages showed is
    // not a next page: it is the same one again, which is what a Next that
    // leads back to its own page loads. Following it again would read it again,
    // up to the page bound, so the read ends here and says why.
    if (shownOnEarlierPages) {
      const repeated = progress.pagesRead > 1 && shownThisPage.length > 0 && shownThisPage.every((content) => shownOnEarlierPages.has(content));
      for (const content of shownThisPage) shownOnEarlierPages.add(content);
      if (repeated) {
        paginationStop = "page_repeated";
        break;
      }
    }

    // Moving to the next page can throw for the same reasons: the control was
    // detached, or the document was replaced while it was being pressed. The read
    // ends here with the pages it has rather than discarding them, and says so.
    let advance: Awaited<ReturnType<typeof advancePage>>;
    try {
      advance = await advancePage(paginate, progress);
    } catch (error) {
      pageFault = true;
      paginationStop = paginationStopOf(error);
      break;
    }
    if (advance.outcome === "advanced") continue;
    truncated = advance.outcome === "truncated";
    timedOut = advance.outcome === "timed_out";
    // A page a control led to that showed no item of the list at all, and
    // nothing to go on with, did not end the list: it lost it -- a rate limit,
    // a check page, an error. The word says so rather than calling it the end.
    const lostTheList = progress.pagesRead > 1 && shown.length === 0 && (advance.stop === "control_absent" || advance.stop === "no_following_page");
    paginationStop = lostTheList ? "list_vanished" : advance.stop;
    break;
  }

  return outcome({ timedOut });
}

/** Whether a throw is a refusal of the whole read, which carries its own failure record, rather than a page fault. */
function isRefusal(error: unknown): boolean {
  return error instanceof Error && typeof (error as { failure?: unknown }).failure === "object" && (error as { failure?: unknown }).failure !== null;
}

/** The rejected rows a read may have to fall back to, kept to the same item bound and the same deduplication as the records. */
function rememberRejected(
  aside: { records: ExtractedListRecord[]; missing: Set<string>; seen: Set<string>; truncated: boolean } | undefined,
  itemRead: ItemRead,
  fields: FieldReaders,
  deduplicate: boolean,
  maxItems: number
): void {
  if (aside === undefined) return;
  if (aside.records.length >= maxItems) {
    aside.truncated = true;
    return;
  }
  if (deduplicate) {
    const content = contentKey(itemRead.record, fields);
    if (aside.seen.has(content)) return;
    aside.seen.add(content);
  }
  aside.records.push(itemRead.record);
  for (const name of itemRead.missing) aside.missing.add(name);
}

/** Whether the read moves from page to page -- replaced in place or loaded anew -- rather than growing one list. */
function movesToAnotherPage(paginate: WebAutomationExtractListPagination | undefined): boolean {
  return paginate !== undefined && (paginate.mode === undefined || paginate.mode === "next" || paginate.mode === "numbered");
}

/** The included fields' readers, in declaration order, refusing a request that names none or reads none. */
function fieldReaders(fields: WebAutomationExtractListRequest["fields"]): FieldReaders {
  const declared = Object.entries(fields);
  if (declared.length === 0) throw new Error("An extract_list request names no fields.");
  const readers = declared.flatMap(([name, field]) => {
    const reader = normalizeExtractField(name, field);
    return reader === undefined ? [] : [[name, reader] as const];
  });
  if (readers.length === 0) throw new Error("An extract_list request reads no fields: every field it names is excluded.");
  return readers;
}

/**
 * How many items the request says the page must hold, which is what the first
 * read waits for. It is `extract-list.ts`'s own `minItems` rule -- 1 when the
 * request names none, so a list that matched nothing is not a success -- read
 * here so the wait and the post-condition cannot disagree.
 */
function requiredItems(requested: number | undefined): number {
  return typeof requested === "number" && Number.isFinite(requested) ? Math.max(0, Math.trunc(requested)) : 1;
}

/** The request's `maxItems` held to the domain's record bound, which is also the bound when it names none. */
function itemBound(requested: number | undefined): number {
  const whole = typeof requested === "number" && !Number.isNaN(requested) ? Math.trunc(requested) : WEB_AUTOMATION_EXTRACT_MAX_ITEMS;
  return Math.min(Math.max(0, whole), WEB_AUTOMATION_EXTRACT_MAX_ITEMS);
}

/**
 * What the answered records are short of, read off the records themselves rather
 * than counted through the loop: a declared field is `null` where an optional
 * read found nothing (D16) and absent where a required one did, so the rows say
 * this without anything having to be carried alongside them -- a continued read's
 * resumed rows included.
 *
 * All three are facts, never failures. A field the author did not require is not
 * a shortfall, but a gap nobody states is worse than one nobody minds: the read
 * that keeps forty rows because three lack a rating has to say that three lack a
 * rating, or the answer looks complete.
 */
function recordGaps(records: readonly ExtractedListRecord[], fields: FieldReaders): { blankFields: string[]; incompleteRecords: number; emptyRecords: number } {
  const blank = new Set<string>();
  let incompleteRecords = 0;
  let emptyRecords = 0;
  for (const record of records) {
    let short = 0;
    for (const [name] of fields) {
      const value = Object.prototype.hasOwnProperty.call(record, name) ? record[name] : undefined;
      if (value !== undefined && value !== null) continue;
      short += 1;
      if (value === null) blank.add(name);
    }
    if (short > 0) incompleteRecords += 1;
    if (short === fields.length && fields.length > 0) emptyRecords += 1;
  }
  return { blankFields: [...blank].sort(), incompleteRecords, emptyRecords };
}

function readRecord(element: Element, fields: FieldReaders): ItemRead {
  const record: ExtractedListRecord = {};
  const missing: string[] = [];
  for (const [name, reader] of fields) {
    const value = readField(element, name, reader);
    if (value === undefined) missing.push(name);
    else record[name] = value;
  }
  return { record, missing };
}

/**
 * A record's content as one comparable string: each field in declaration
 * order, as `[value]` when the record carries it and `[]` when a required
 * field was missing, so no two different records share a key.
 */
function contentKey(record: ExtractedListRecord, fields: FieldReaders): string {
  return JSON.stringify(fields.map(([name]) => (Object.prototype.hasOwnProperty.call(record, name) ? [record[name]] : [])));
}
