// Waiting for a list to show its records: the page the read has just reached,
// and the page it starts on.
//
// **The page it starts on needs the same wait, and until 2026-09-23 it had
// none.** `extractList` queried the document the moment it was called, so a
// read dispatched against a page still rendering its list read an empty one
// and reported it as a successful read of nothing. A recorded Flow hid this
// because its recording carries an explicit wait step; a Flow a model built by
// running nodes carries no such step, so on the everything-store -- whose
// results replace eight placeholder cards 700ms after load -- the built Flow
// replayed every step and returned 0 records where 16 were expected. Measured
// model-free: the same request that read 20 records on the settled page read
// **0** on a fresh one and 15 a second and a half later.
//
// `awaitListPresent` is that wait, and it is a ceiling rather than a sleep: the
// read goes on the instant the page holds the items the request requires, so a
// fast page is read as fast as it ever was. What it waits *for* is the
// request's own `minItems` -- the author's statement of what the page must hold
// -- so a read told an empty list is a valid answer (`minItems: 0`, which the
// picker's preview sends) waits for nothing at all, and a read of one page told
// to expect sixteen waits for the sixteenth rather than reading the twelve that
// rendered first. A read that pages waits only for its first item, because the
// rest may legitimately be on a later page.
//
// A list that changed has not necessarily arrived. A client-rendered search
// replaces its results with skeleton cards the moment a page number is
// pressed, fetches, and only then draws the next page; a search asked for
// pages too quickly answers with a security check first and the page later; a
// Next that loads a new document can land on a page still drawing. Reading at
// the first change reads the skeleton -- nothing -- and a numbered read then
// finds no page controls either, so it ends on page 1 believing the list did.
//
// So a page counts as arrived when it shows an item the read has not taken.
// A page can also truly hold no item the read wants -- a filtered read of a
// page whose every listing is filtered out -- and that page must not be waited
// on for ever, so it counts as arrived once it has shown its pagination
// controls, and still no such item, for `EMPTY_PAGE_SETTLE_MS`. The controls
// are the difference between the two cases above: a skeleton or a check draws
// none, because the page's controls come with its results. Short of either,
// the wait gives up after `RENDER_WINDOW_MS` and the page is read as it stands,
// which on the last page of a list whose controls end with it is the ordinary
// way such a read finishes. The command's deadline bounds all of it.
//
// **A ceiling is only a ceiling while the page can still reach it.** A read
// whose `item` selector names nothing on this page waited the whole of
// `RENDER_WINDOW_MS`, or the whole of the command's `timeoutMs` where that was
// shorter, and then read the page anyway and reported no records as a clean
// read -- so the cost was paid in full for an answer the page had already
// given. Live run `run-muhnh0s5-98a27f42` paid it six times over while the
// model amended one extraction and reran it: six `web.dom.extract_list` calls
// at 11.04, 11.04, 11.04, 11.04, 11.05 and 11.05 seconds, each of them ten
// seconds of this wait plus a round trip, and every one of them `succeeded`.
// The run before it, `run-muher0en-508ddb69`, shows the same figure eight
// times.
//
// **On 2026-09-25 that observation was acted on the wrong way round, and it
// became the loop's dominant failure.** `a05134a` ended the wait for the list
// to *appear* as soon as the document had finished loading and been
// mutation-quiet for `PAGE_STILL_MS`, whether or not a single item had matched,
// reasoning that `querySelectorAll` can only start matching when a node is
// added or removed or an attribute changes, so a quiet complete document cannot
// discover anything in the rest of the window. The reasoning is right about the
// DOM and wrong about pages: **a page whose next change comes from a
// `setTimeout` is mutation-quiet and `readyState: "complete"`, and is
// indistinguishable from a finished one.** That is every gate a real site puts
// in front of a list -- a notification prompt whose backdrop covers the whole
// page and lifts four seconds after load, a browser check that passes a
// shopper who simply waits eight seconds in and then reloads onto what was
// asked for. Fourteen live extraction attempts at
// `everything-store-plus-earbuds-under-50` separate on this and on nothing
// else: 2089, 2576, 2109 and 2082 ms read **zero** records, while 255, 4631,
// 6935, 10068, 11082, 14256, 14258 and 14264 ms read rows. The read declared
// the page incapable of producing a list while the list was two to six seconds
// away. (`docs/working/language-driven-flow-loop-plan/reports/
// t143-why-the-read-returns-nothing.md` is the measurement.)
//
// **So stillness is evidence about a list that is there, never about one that
// is not.** A quiet document holding twelve items where the read wants sixteen
// has said what it has -- the sixteenth is not coming, and that wait ends on
// `PAGE_STILL_MS`, which is the saving `a05134a` was after and the part of it
// that was sound. A quiet document holding *none* has said nothing at all: an
// empty match and a settled page are two different facts, and only the first is
// about the answer. That wait therefore pays `RENDER_WINDOW_MS`, the command's
// `timeoutMs` and its own deadline, exactly as it did before `a05134a`, and a
// page that truly never had a list pays the whole of it -- which is the price of
// not reporting a gate as an empty page. Making `PAGE_STILL_MS` larger would
// not have fixed it and would have slowed every honest empty read: no constant
// tells a page that is finished from a page that is waiting on a timer.
//
// **And a wait that ran out is a fact about the read, not a detail of the
// wait.** A read whose `item` selector named nothing answers `succeeded` with
// zero records, which is exactly what a page holding nothing answers, and the
// two need different repairs: one changes the selector, the other the
// instruction. That is the same defect
// `WebAutomationExtractionConditionReport` was written for one layer down --
// "a filtered read that answers with nothing is indistinguishable from a page
// with nothing on it" -- so it is answered the same way, with a fact in the
// summary rather than a failure. `awaitListPresent` therefore returns a
// `ListWait`: whether the list was ever there, how many items were being waited
// for, how long the wait took, and which of the four things ended it.
// `list-reader.ts` carries it out on the read's outcome,
// `domain/src/actions/extraction/summary.ts` declares all four on the wire --
// the presence in one closed word and the rest as `listWait` -- and
// `content/actions/extract-list.ts` also says them in the result's `actual`,
// because a field is what a scan over a run's bundles can group by and a phrase
// is what the model reading one failure actually reads. Working those four zero
// reads back to a two-second settle from their durations alone took a day, and a
// read that waited and found nothing should say what it waited for rather than
// leave it to be reconstructed.

import type { WebAutomationExtractListPagination } from "../types";
import { waitUntil } from "./list-wait";

/** Whether the page arrived, or the command's deadline passed first. */
export type PageArrival = "arrived" | "timed_out";

/**
 * Whether the `item` selector named anything by the time the wait for it
 * ended. `"never_appeared"` is the wait having run out -- on the page settling,
 * on the ceiling, or on the command's deadline -- with the selector still
 * naming nothing, which is the one thing a read of zero records cannot say for
 * itself.
 */
export type ListPresence = "appeared" | "never_appeared";

/**
 * Which of the four things ended the wait for the list to appear.
 *
 * `"page_settled"` is only ever reached by a wait that already had items and
 * wanted more of them (see the header), so it can never be the reason a read of
 * zero records stopped. That is the whole of the 2026-09-25 regression stated as
 * a type: before, `"page_settled"` and `"never_appeared"` could and did occur
 * together, and the pair was the answer the loop kept getting.
 */
export type ListWaitStop = "list_present" | "page_settled" | "window_elapsed" | "deadline_passed";

/**
 * What the wait for the list did, which is what a read of zero records has no
 * other way to state: whether the list was ever there, how many items were
 * being waited for, how long the whole wait took, and why it stopped.
 *
 * None of it is a verdict. `"never_appeared"` does not stop the read, and the
 * caller carries the account beside the records rather than as a reason to
 * refuse or retry.
 */
export type ListWait = {
  presence: ListPresence;
  stoppedOn: ListWaitStop;
  /** How long the whole of `awaitListPresent` took, the growth settle included. */
  waitedMs: number;
  /** How many items the wait was waiting for: the request's own minimum, held to at least one. */
  waitedFor: number;
};

/** What the wait needs to know about the read: its deadline, and whether the page shows an item it has not taken. */
export type RenderProgress = { deadline: number | undefined; hasUnreadItem(): boolean };

/** How long a page the read reached is given to show its records or settle without them. */
const RENDER_WINDOW_MS = 10_000;
/** How long a page must show its pagination controls and no unread item to be read as holding none. */
const EMPTY_PAGE_SETTLE_MS = 2_000;
/** How long a one-page read's list must stop growing to be read: the window `pagination.ts` gives a lazy list to grow. */
const LIST_GROWTH_SETTLE_MS = 900;
/**
 * How long the document must hold still, with *some* of the list drawn and the
 * rest of it missing, before the wait for the rest gives up: the same window
 * `EMPTY_PAGE_SETTLE_MS` gives a page that has drawn its controls and no
 * record. It is deliberately not asked of a page that has drawn nothing the
 * read can name -- see the header, and `ListWaitStop`.
 */
const PAGE_STILL_MS = 2_000;
const RENDER_POLL_MS = 50;

/** Waits for the page the read has just reached to show its records; see the header. */
export async function awaitPageRendered(paginate: WebAutomationExtractListPagination, progress: RenderProgress): Promise<PageArrival> {
  let settlingSince: number | undefined;
  const arrived = (): boolean => {
    if (progress.hasUnreadItem()) return true;
    if (!paginationControlsShown(paginate)) {
      settlingSince = undefined;
      return false;
    }
    settlingSince ??= Date.now();
    return Date.now() - settlingSince >= EMPTY_PAGE_SETTLE_MS;
  };
  const outcome = await waitUntil(arrived, RENDER_WINDOW_MS, RENDER_POLL_MS, progress.deadline);
  return outcome === "timed_out" ? "timed_out" : "arrived";
}

/**
 * Waits for the page the read starts on to hold `required` items, and, for a
 * read of one page, for that list to stop growing.
 *
 * `required` is the request's `minItems`, held to at least one. An empty list
 * and a list the page has not drawn yet are the same document, so a read that
 * did not wait for one could not tell them apart -- and `minItems: 0` says
 * "an empty list is a valid answer", which is a post-condition rather than an
 * instruction to read early. Live, the model wrote `minItems: 0` on the very
 * first Flow built after this wait landed (`run-mudqlqsk-8876a3ea`), so a wait
 * that took it literally would have been switched off by the one party it
 * exists to protect. A list that is there is still read at once; a list that
 * never appears pays the window, the command's `timeoutMs` or the read's
 * deadline, whichever comes first, because a page that has gone quiet without
 * drawing a single item has not said the list is not coming (see the header).
 *
 * The settle is only for a read that does not page. A paginated read has its
 * own mechanism for a list that grows -- `pagination.ts` follows the control
 * or scrolls and waits for the list to change -- and adding a second one would
 * spend that read's deadline twice. A read of one page has none, so a list
 * that arrives in two parts, as a results page whose last items load when the
 * bottom scrolls into view does, would be read at its first part.
 *
 * All of it is bounded by `RENDER_WINDOW_MS`, by the command's own deadline and
 * -- once the list is partly there -- by the document holding still (see the
 * header), and running out of any of them is not a failure here: the read
 * proceeds and reads what the page holds, so what it reports is still the page
 * as it stands rather than an error this module invented.
 */
export async function awaitListPresent(item: string, required: number, settle: boolean, progress: RenderProgress): Promise<ListWait> {
  const startedAt = Date.now();
  const wanted = Math.max(1, required);
  const stoppedOn = await searchForList(item, wanted, progress);
  if (settle) await awaitListStoppedGrowing(item, progress);
  // Asked at the end rather than recorded through the wait, because the read
  // that follows queries this same document a moment later: a list drawn during
  // the growth settle is one the read will see.
  return { presence: matchCount(item) > 0 ? "appeared" : "never_appeared", stoppedOn, waitedMs: Date.now() - startedAt, waitedFor: wanted };
}

/**
 * Waits for the item selector to name `wanted` elements, and says what ended
 * the wait.
 *
 * The stillness is asked only of a poll that already names something, which is
 * the rule the header argues for: a settled page holding some of the list has
 * said the rest is not coming, and a settled page holding none of it has said
 * nothing. So it is also *created* only then -- a wait for a list that is not
 * there yet observes no document at all, and one whose list arrives in parts
 * measures its quiet from the moment the first part landed rather than from a
 * clock that started before the page had drawn anything.
 *
 * The growth settle in `awaitListStoppedGrowing` is not given the stillness
 * either: it is already a statement about the page having stopped changing,
 * measured on the list itself rather than on the whole document, and asking
 * both would let the coarser one end the finer one early.
 */
async function searchForList(item: string, wanted: number, progress: RenderProgress): Promise<ListWaitStop> {
  let still: { settled(): boolean; stop(): void } | undefined;
  let stopped: ListWaitStop | undefined;
  try {
    const ended = await waitUntil(
      () => {
        const matched = matchCount(item);
        if (matched >= wanted) {
          stopped = "list_present";
          return true;
        }
        if (matched === 0) return false;
        still ??= documentStillness();
        if (!still.settled()) return false;
        stopped = "page_settled";
        return true;
      },
      RENDER_WINDOW_MS,
      RENDER_POLL_MS,
      progress.deadline
    );
    return stopped ?? (ended === "timed_out" ? "deadline_passed" : "window_elapsed");
  } finally {
    still?.stop();
  }
}

/** Waits for a one-page read's list to stop growing on its own; see `awaitListPresent`. */
async function awaitListStoppedGrowing(item: string, progress: RenderProgress): Promise<void> {
  let count = matchCount(item);
  let stableSince = Date.now();
  await waitUntil(
    () => {
      const now = matchCount(item);
      if (now !== count) {
        count = now;
        stableSince = Date.now();
        return false;
      }
      return Date.now() - stableSince >= LIST_GROWTH_SETTLE_MS;
    },
    RENDER_WINDOW_MS,
    RENDER_POLL_MS,
    progress.deadline
  );
}

/**
 * Whether the document can still change what the item selector names.
 *
 * `childList` with `subtree` catches every node added or removed anywhere, and
 * `attributes` every attribute a selector could match on; character data is
 * deliberately not observed, because no CSS selector reads text and a ticking
 * clock or a live counter would otherwise hold a settled page open for the
 * whole ceiling. The clock starts at construction, and `searchForList`
 * constructs this at the first poll whose selector names an item, so a list
 * arriving in parts always gets `PAGE_STILL_MS` of quiet after its first part
 * before anything is concluded from the quiet.
 *
 * `readyState` is asked as well as the observer: a document still parsing or
 * still fetching its subresources has not had its say, however quiet the
 * moment. Where there is no `MutationObserver` to ask, nothing ever settles and
 * the wait is the one it was before: not observing is not evidence that the
 * page is done.
 */
function documentStillness(): { settled(): boolean; stop(): void } {
  const observe = (globalThis as { MutationObserver?: typeof MutationObserver }).MutationObserver;
  if (!observe) return { settled: () => false, stop: () => undefined };
  let changedAt = Date.now();
  const observer = new observe(() => { changedAt = Date.now(); });
  observer.observe(document, { childList: true, subtree: true, attributes: true });
  return {
    settled: () => document.readyState === "complete" && Date.now() - changedAt >= PAGE_STILL_MS,
    stop: () => { observer.disconnect(); }
  };
}

/** How many elements the item selector names, treating a selector the browser cannot parse as naming none. */
function matchCount(item: string): number {
  try {
    return document.querySelectorAll(item).length;
  } catch {
    return 0;
  }
}

/** Whether the page shows the controls the request pages with. A scroll read has none, so it never settles early. */
function paginationControlsShown(paginate: WebAutomationExtractListPagination): boolean {
  switch (paginate.mode) {
    case undefined:
    case "next":
      return document.querySelector(paginate.next) !== null;
    case "loadMore":
      return document.querySelector(paginate.control) !== null;
    case "numbered":
      return document.querySelector(paginate.pages) !== null;
    default:
      return false;
  }
}
