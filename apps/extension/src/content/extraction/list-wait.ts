// The waits a list read makes on the page: the poll every other wait is built
// from, and the one that decides a one-page list is *complete* rather than
// merely present. `pagination.ts` polls with it for a list to change after a
// control is followed, and `page-render.ts` for a page the read reached to show
// its records.
//
// **Present is not complete, and until 2026-09-23 a read stopped at present.**
// `page-render.ts` waits for the page to hold the items the request requires,
// then for that list to stop growing on its own. A results page that loads its
// last results only when the bottom of the list scrolls into view is stable at
// that moment and is not finished: nothing is arriving, and nothing will,
// because the page is waiting to be scrolled. The everything store draws twelve
// of its sixteen first-page results and fetches the rest from a sentinel under
// the twelfth, so a built Flow read twelve rows where sixteen were expected
// (`run-mudwci8d-de88aa32`) -- right columns, right filter, four rows short.
//
// **So the read reveals the end of the list itself.** The alternative was a
// `web.dom.scroll` node the model must remember to author before its
// extraction, and in every live build so far it never has: a recording carries
// an explicit scroll step because a person scrolled while recording, while a
// Flow assembled from nodes carries only what the model wrote. Completeness is
// a property of reading a list, not a step of the Flow, so it belongs here --
// where it holds for every Flow, the ones the model forgets to scroll included.
//
// What a reveal is: the element after the list's last item scrolled to the
// bottom of the viewport, or the last item itself when it is the last thing in
// its container. That is the smallest movement that brings a loader sitting
// under the list into reach, it fires the scroll the page is listening for, and
// it scrolls whatever ancestor actually scrolls -- a window, a pane, a dialog --
// because `scrollIntoView` scrolls each of them. It deliberately does not
// scroll to the end of the *document*: a virtualised list unmounts what it has
// scrolled past, and the read has not read these items yet.
//
// A reveal that moves nothing reveals nothing, so a page whose list already
// ends on screen pays neither a scroll nor a wait -- which is most pages, and
// is why this is not a fixed cost on every read. A reveal that moves and grows
// the list is followed by another, because a list that loads in parts loads the
// next part the same way; `LIST_REVEALS` bounds that, so a feed that goes on
// for ever is not swept by a read that never asked to page. A read that pages
// by scrolling has its own bounded mechanism (`pagination.ts`) and does not
// come here at all.

/** What a wait saw: its condition, nothing within its window, or the command's deadline. */
export type WaitOutcome = "changed" | "unchanged" | "timed_out";

/** How long a revealed list has to grow: the window `pagination.ts` gives a lazy feed after a scroll. */
const LIST_GROWTH_WINDOW_MS = 900;
const LIST_GROWTH_POLL_MS = 50;
/**
 * How many times one read reveals the end of its list. A page that loads its
 * list in parts is finished in one or two; the bound is what keeps a read that
 * never asked to page from sweeping an endless feed.
 */
const LIST_REVEALS = 4;
/** Subpixel layout differences are not a scroll, as `pagination.ts` says of a scroller at its bottom. */
const MOVED_PX = 2;

/**
 * Polls `condition` until it holds, its window closes, or the command's
 * deadline passes, and says which: the window closing first is the page not
 * responding, the deadline passing first is the read running out of time.
 */
export async function waitUntil(condition: () => boolean, windowMs: number, pollMs: number, actionDeadline: number | undefined): Promise<WaitOutcome> {
  const windowEnd = Date.now() + windowMs;
  const commandEndsFirst = actionDeadline !== undefined && actionDeadline <= windowEnd;
  const end = commandEndsFirst ? actionDeadline : windowEnd;
  while (!condition()) {
    const now = Date.now();
    if (now >= end) return commandEndsFirst ? "timed_out" : "unchanged";
    await new Promise<void>((resolve) => { setTimeout(resolve, Math.min(pollMs, end - now)); });
  }
  return "changed";
}

/**
 * Brings the whole of a one-page list onto the page: reveals its end and waits
 * for what that brings, until a reveal brings nothing, nothing moves, the list
 * holds as many items as the read can use, the reveals run out, or the
 * command's deadline passes. See the header.
 *
 * `wanted` is how many items the read could still use. A read that already sees
 * its own `maxItems` has nothing to gain by revealing more and does not touch
 * the page for them -- which is what keeps the picker's five-row preview from
 * scrolling the page a person is looking at. Only a read with no `where` can
 * say that from the page, since a filtered read's items are not its records.
 *
 * Running out is not a failure: the read goes on and reads the list as it
 * stands, so what it reports is still the page rather than an error invented
 * here, exactly as `awaitListPresent` does.
 */
export async function awaitListComplete(item: string, wanted: number, actionDeadline: number | undefined): Promise<void> {
  for (let reveal = 0; reveal < LIST_REVEALS; reveal += 1) {
    const before = matchCount(item);
    if (before === 0 || before >= wanted) return;
    if (!revealListEnd(item)) return;
    const grew = await waitUntil(() => matchCount(item) > before, LIST_GROWTH_WINDOW_MS, LIST_GROWTH_POLL_MS, actionDeadline);
    if (grew !== "changed") return;
  }
}

/**
 * Scrolls the end of the list into view and says whether anything moved. What
 * is scrolled to is the element after the last item -- the loader, where a page
 * puts one -- and the last item itself where there is none.
 */
function revealListEnd(item: string): boolean {
  const items = matches(item);
  const last = items[items.length - 1];
  if (!last) return false;
  const before = last.getBoundingClientRect().top;
  (last.nextElementSibling ?? last).scrollIntoView({ block: "end", behavior: "instant" });
  return Math.abs(last.getBoundingClientRect().top - before) > MOVED_PX;
}

/**
 * The elements the item selector names. A selector the browser cannot parse
 * throws here as it does in the read's own loop, which is where a request
 * carrying one fails today: this wait does not turn it into a list of nothing,
 * because a read that then reported "no records" would be reporting a page
 * rather than a request it could not run.
 */
function matches(item: string): Element[] {
  return Array.from(document.querySelectorAll(item));
}

function matchCount(item: string): number {
  return matches(item).length;
}
