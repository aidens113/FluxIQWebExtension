// Run in the page, injected by `./page-work.ts`: whether the page has finished
// the work it scheduled for itself and its document has stopped changing (task
// speed S10). Self-contained, because an injected function carries nothing of
// the module it was written in: it reads only `window` and `document`.
//
// Answers false at once when no page world is counting (`watchedEvent` not
// cancelled), so the worker keeps the old second. Otherwise it waits for the
// page world's count to drain (`drainedEvent`), and confirms it one task later
// -- a timer's callback may have awaited something that begins the next piece
// -- with the document unchanged across that task, as the page-changes counter
// would say (a `MutationObserver` over the whole document). A page that drains
// while still changing is looked at again a task later; there is no deadline
// here, because recurring work is never counted (`page-world/page-work/`), and
// the worker's own wait bounds the rest.

export function pageSettledInPage(watchedEvent: string, busyEvent: string, drainedEvent: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const asked = (type: string): boolean => !window.dispatchEvent(new CustomEvent(type, { cancelable: true }));
    if (!asked(watchedEvent)) {
      resolve(false);
      return;
    }
    let changed = false;
    const observer = new MutationObserver(() => {
      changed = true;
    });
    observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    let look: ReturnType<typeof setTimeout> | undefined;
    const finish = (): void => {
      observer.disconnect();
      window.removeEventListener(drainedEvent, onDrained);
      resolve(true);
    };
    function confirm(): void {
      look = undefined;
      if (asked(busyEvent)) return;
      if (changed) {
        changed = false;
        look = setTimeout(confirm, 0);
        return;
      }
      finish();
    }
    function onDrained(): void {
      if (look === undefined) look = setTimeout(confirm, 0);
    }
    window.addEventListener(drainedEvent, onDrained);
    look = setTimeout(confirm, 0);
  });
}
