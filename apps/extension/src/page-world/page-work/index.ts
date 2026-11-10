// The page world's count of the work a page schedules for itself
// (`shared/scheduled-work-event.ts`, task speed S10): timers due within the horizon,
// animation frames, fetches and XHRs, each until it is done, with recurring work
// left out. Installed before the request-start probe and the press-work watch,
// so their wrappers sit over these and their own health checks still hold, and
// every call the page makes still passes through here.

import { PAGE_WORK_BUSY_EVENT, PAGE_WORK_DRAINED_EVENT, PAGE_WORK_WATCHED_EVENT } from "../../shared/scheduled-work-event";
import { inExtensionWorld } from "../extension-world";
import { installPageWorkRequests } from "./requests";
import { installPageWorkTimers } from "./timers";
import { createPageWorkTracker } from "./tracker";

type WatchHost = Window & { __fluxiqPageWorkInstalled?: boolean };

/** Installs the count in this window; false in an isolated world, or where a function it needs could not be followed. */
export function installPageWorkWatch(): boolean {
  if (inExtensionWorld()) return false;
  const host = window as WatchHost;
  if (host.__fluxiqPageWorkInstalled === true) return true;
  host.__fluxiqPageWorkInstalled = true;
  const dispatch = EventTarget.prototype.dispatchEvent;
  const EventClass = Event;
  const tracker = createPageWorkTracker(() => {
    dispatch.call(window, new EventClass(PAGE_WORK_DRAINED_EVENT));
  });
  const timers = installPageWorkTimers(window as unknown as Record<string, unknown>, tracker);
  const requests = installPageWorkRequests(window as unknown as Record<string, unknown>, tracker);
  const complete = timers && requests;
  // A page world that could not follow all of it says it is not counting, and readiness keeps the old second.
  window.addEventListener(PAGE_WORK_WATCHED_EVENT, (event: Event) => {
    if (complete) event.preventDefault();
  }, true);
  window.addEventListener(PAGE_WORK_BUSY_EVENT, (event: Event) => {
    if (tracker.busy(document.visibilityState === "hidden")) event.preventDefault();
  }, true);
  return complete;
}
