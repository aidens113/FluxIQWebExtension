// Whether the page has finished drawing what the next step will act on: the
// page world says no work that can still be drawing it is out, and its document
// has stopped changing (task speed S10; t1094). Asked from two places: the
// worker injects it into a tab's top frame (`runtime/navigation-events/page-work.ts`)
// when a page has loaded, and the content script calls it before an action on a
// page whose address moved in place since it last looked
// (`content/action-runtime/page-work/`, t893). Self-contained, because an
// injected function carries nothing of the module it was written in: it reads
// only `window`, and imports nothing, so both bundles include it.
//
// Answers false at once when no page world is counting (`watchedEvent` not
// cancelled), so the asker keeps the old second. Otherwise the page world
// answers `busyEvent` (`page-world/page-work/`): busy while work that can still
// be drawing the page is out, or its document changed within the quiet window
// (`PAGE_QUIET_WINDOW_MS`, `shared/scheduled-work-event.ts`). A page that says
// it is not busy is settled at once. One that is busy is asked again a task
// after its count drains (`drainedEvent`) -- a timer's callback may have
// awaited something that begins the next piece -- and every
// `SETTLE_LOOK_MS` in between, because work that changes nothing stops holding
// the page with time rather than with an event.
//
// Before t1094 it waited for every request and every fresh timer to finish and
// confirmed the document unchanged across one task. A real site never finishes
// its network -- beacons, long polls, chat widgets, ad refreshes -- so the wait
// ran to the asker's deadline on every step. The page world now decides which
// work holds the page (`page-world/page-work/tracker.ts`).
//
// `options.withinMs` bounds the wait: it answers false then, and nothing is
// left listening, so a page that never stops changing leaves nothing behind in
// the page after the worker's own deadline. An asker in the same world may pass
// `options.signal` to stop waiting: the answer is then false.

/** Whether the page is settled, asked as the header says; false without a page world, at `options.withinMs`, or when `options.signal` stops it. */
export function pageSettledInPage(
  watchedEvent: string,
  busyEvent: string,
  drainedEvent: string,
  options: { withinMs?: number; signal?: AbortSignal } = {}
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    // How often a busy page is asked again (header): a literal, because an injected function carries no module constant.
    const SETTLE_LOOK_MS = 50;
    const { withinMs, signal } = options;
    const asked = (type: string): boolean => !window.dispatchEvent(new CustomEvent(type, { cancelable: true }));
    if (signal?.aborted === true || !asked(watchedEvent)) {
      resolve(false);
      return;
    }
    if (!asked(busyEvent)) {
      resolve(true);
      return;
    }
    let look: ReturnType<typeof setTimeout> | undefined;
    let bound: ReturnType<typeof setTimeout> | undefined;
    const finish = (settled: boolean): void => {
      if (look !== undefined) clearTimeout(look);
      if (bound !== undefined) clearTimeout(bound);
      look = undefined;
      bound = undefined;
      window.removeEventListener(drainedEvent, onDrained);
      signal?.removeEventListener("abort", abandoned);
      resolve(settled);
    };
    // The asker stopped waiting (its own deadline, or its wait ended another way): nothing is left listening.
    function abandoned(): void {
      finish(false);
    }
    function again(): void {
      look = undefined;
      if (!asked(busyEvent)) finish(true);
      else look = setTimeout(again, SETTLE_LOOK_MS);
    }
    // Drained inside the page's own task: asked again in a later one, once what that task awaited has begun.
    function onDrained(): void {
      if (look !== undefined) clearTimeout(look);
      look = setTimeout(again, 0);
    }
    window.addEventListener(drainedEvent, onDrained);
    signal?.addEventListener("abort", abandoned);
    if (withinMs !== undefined) bound = setTimeout(() => finish(false), Math.max(0, withinMs));
    look = setTimeout(again, SETTLE_LOOK_MS);
  });
}
