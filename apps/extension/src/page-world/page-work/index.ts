// The page world's count of the work a page schedules for itself
// (`shared/scheduled-work-event.ts`, task speed S10): timers due within the horizon,
// animation frames, fetches and XHRs, each until it is done or, for work that
// changes nothing, until it stops holding the page (`./tracker.ts`, t1094), with
// recurring work left out; and when the document last changed
// (`./document-changes.ts`). The page is busy while such work is out or its
// document changed within `PAGE_QUIET_WINDOW_MS`. Installed before the request-start probe and the press-work watch,
// so their wrappers sit over these and their own health checks still hold, and
// every call the page makes still passes through here.

import { PAGE_QUIET_WINDOW_MS, PAGE_WORK_BUSY_EVENT, PAGE_WORK_DRAINED_EVENT, PAGE_WORK_PENDING_EVENT, PAGE_WORK_WATCHED_EVENT } from "../../shared/scheduled-work-event";
import { inExtensionWorld } from "../extension-world";
import { watchDocumentChanges } from "./document-changes";
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
  const watching = watchDocumentChanges(() => { tracker.changed(); });
  const timers = installPageWorkTimers(window as unknown as Record<string, unknown>, tracker);
  const requests = installPageWorkRequests(window as unknown as Record<string, unknown>, tracker);
  const complete = watching && timers && requests;
  // A page world that could not follow all of it -- or cannot see its document change -- says it is not counting, and readiness keeps the old second.
  window.addEventListener(PAGE_WORK_WATCHED_EVENT, (event: Event) => {
    if (complete) event.preventDefault();
  }, true);
  window.addEventListener(PAGE_WORK_BUSY_EVENT, (event: Event) => {
    if (tracker.busy(document.visibilityState === "hidden") || tracker.changedWithin(PAGE_QUIET_WINDOW_MS)) event.preventDefault();
  }, true);
  window.addEventListener(PAGE_WORK_PENDING_EVENT, (event: Event) => {
    if (complete && tracker.busy(document.visibilityState === "hidden", true)) event.preventDefault();
  }, true);
  return complete;
}
