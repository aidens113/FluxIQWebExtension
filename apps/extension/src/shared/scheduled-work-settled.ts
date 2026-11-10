// Whether the page has finished the work it scheduled for itself and its
// document has stopped changing (task speed S10). Asked from two places: the
// worker injects it into a tab's top frame (`runtime/navigation-events/page-work.ts`)
// when a page has loaded, and the content script calls it before an action on a
// page whose address moved in place since it last looked
// (`content/action-runtime/page-work/`, t893). Self-contained, because an
// injected function carries nothing of the module it was written in: it reads
// only `window` and `document`, and imports nothing, so both bundles include it.
//
// Answers false at once when no page world is counting (`watchedEvent` not
// cancelled), so the asker keeps the old second. Otherwise it waits for the
// page world's count to drain (`drainedEvent`), and confirms it one task later
// -- a timer's callback may have awaited something that begins the next piece
// -- with the document unchanged across that task, as the page-changes counter
// would say (a `MutationObserver` over the whole document). A page that drains
// while still changing is looked at again a task later; there is no deadline
// here, because recurring work is never counted (`page-world/page-work/`), and
// the asker's own wait bounds the rest. An asker in the same world may pass a
// `signal` to stop waiting: the answer is then false, and nothing is left
// listening. The worker's injected call passes none.

export function pageSettledInPage(watchedEvent: string, busyEvent: string, drainedEvent: string, signal?: AbortSignal): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const asked = (type: string): boolean => !window.dispatchEvent(new CustomEvent(type, { cancelable: true }));
    if (signal?.aborted === true || !asked(watchedEvent)) {
      resolve(false);
      return;
    }
    let changed = false;
    const observer = new MutationObserver(() => {
      changed = true;
    });
    observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    let look: ReturnType<typeof setTimeout> | undefined;
    const finish = (settled: boolean): void => {
      if (look !== undefined) clearTimeout(look);
      look = undefined;
      observer.disconnect();
      window.removeEventListener(drainedEvent, onDrained);
      signal?.removeEventListener("abort", abandoned);
      resolve(settled);
    };
    // The asker stopped waiting (its own deadline, or its wait ended another way): nothing is left listening.
    function abandoned(): void {
      finish(false);
    }
    function confirm(): void {
      look = undefined;
      if (asked(busyEvent)) return;
      if (changed) {
        changed = false;
        look = setTimeout(confirm, 0);
        return;
      }
      finish(true);
    }
    function onDrained(): void {
      if (look === undefined) look = setTimeout(confirm, 0);
    }
    window.addEventListener(drainedEvent, onDrained);
    signal?.addEventListener("abort", abandoned);
    look = setTimeout(confirm, 0);
  });
}
