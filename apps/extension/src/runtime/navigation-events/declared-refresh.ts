// Whether a page has declared it will move by itself soon: a
// `<meta http-equiv="refresh" content="N; url=...">` due within the stable-
// address second `waitForTabReady` used to wait out after every load (task
// speed S10, `../automation-tab.ts`). A move the page has only scheduled through
// the document's own markup is no work the page world counts; this is the
// evidence that one is coming. A page that declares one keeps the old second,
// so its move begins before anything acts on it; any later move is a navigation
// event that the next action waits out (`./epochs.ts`).
//
// Read through the top frame alone, by a function injected for the read; only
// the delay leaves the page, never the address.

import { declaredRefreshDelayMs } from "./refresh-delay";

/** A refresh due within this long of the load is waited for, as the stable-address second waited it out. */
const DECLARED_REFRESH_WAITED_MS = 1_000;

/** Whether the tab's top document declares a refresh due within `DECLARED_REFRESH_WAITED_MS`. A page that cannot be read declares nothing. */
export async function refreshDeclaredSoon(tabId: number): Promise<boolean> {
  try {
    const [answer] = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      func: () => document.querySelector('meta[http-equiv="refresh" i]')?.getAttribute("content") ?? null
    });
    const delay = declaredRefreshDelayMs(answer?.result as string | null | undefined);
    return delay !== undefined && delay <= DECLARED_REFRESH_WAITED_MS;
  } catch {
    return false;
  }
}
