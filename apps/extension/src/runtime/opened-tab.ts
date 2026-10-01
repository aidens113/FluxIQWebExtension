// Whether a click opened its page in a tab of its own.
//
// A link with `target="_blank"` -- crossborder's search result cards, and many
// a real store's -- does not navigate the tab it was pressed in. The browser
// opens a new tab and loads the page there. The content script can only say
// that the navigation began (`content/actions/click.ts`), and the click's own
// tab never commits anything, so until 2026-10-01 such a click came back a
// success while every later step, in the build and in playback, ran on the
// results page and the item sat in a tab nothing drove (lane A, `t174-w32`).
//
// The browser names the tab a navigation was opened from
// (`webNavigation.onCreatedNavigationTarget`, `sourceTabId`), so the tab a
// click opened is the one created from the clicked tab while the click was
// being judged. `click-landing.ts` then drives that tab instead. Nothing of the
// page is read here: a tab id is all this reports.
//
// A browser without the event reports no tab, and the click is judged as it
// always was.

/** What the source tab's opened-tab events are read for. */
type CreatedTarget = { sourceTabId: number; tabId: number };

export type OpenedTabWatch = {
  /** The tab opened from the source tab since the watch began, waiting up to `windowMs` for one; undefined when none was. */
  settle(windowMs: number): Promise<number | undefined>;
  /** Stops listening; safe to call more than once. */
  stop(): void;
};

/** Starts listening, before the click is sent, for a tab opened from `sourceTabId`. Only the first such tab is kept. */
export function watchOpenedTab(sourceTabId: number): OpenedTabWatch {
  const created = chrome.webNavigation?.onCreatedNavigationTarget;
  let opened: number | undefined;
  let wake: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onCreated = (details: CreatedTarget): void => {
    if (details.sourceTabId !== sourceTabId || opened !== undefined) return;
    opened = details.tabId;
    wake?.();
  };
  created?.addListener(onCreated);
  return {
    settle(windowMs) {
      if (opened !== undefined || windowMs <= 0 || created === undefined) return Promise.resolve(opened);
      return new Promise((resolve) => {
        const finish = (): void => {
          clearTimeout(timer);
          timer = undefined;
          wake = undefined;
          resolve(opened);
        };
        timer = setTimeout(finish, windowMs);
        wake = finish;
      });
    },
    stop() {
      clearTimeout(timer);
      created?.removeListener(onCreated);
    }
  };
}
