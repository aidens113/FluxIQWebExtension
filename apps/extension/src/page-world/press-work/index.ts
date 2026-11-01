import { PRESS_WORK_EVENTS } from "../../shared/press-work-event";
import { inExtensionWorld } from "../extension-world";
import { createPressWorkTracker } from "./tracker";
import { installPressWorkHandlers } from "./handlers";
import { installPressWorkScheduling } from "./scheduling";

/** Supported causal work is a page observation, not authentication against hostile page code. */
export function installPressWorkWatch(): boolean {
  if (inExtensionWorld()) return false;
  const host = window as Window & { __fluxiqPressWorkInstalled?: boolean };
  if (host.__fluxiqPressWorkInstalled) return true;
  host.__fluxiqPressWorkInstalled = true;
  const add = EventTarget.prototype.addEventListener;
  const tracker = createPressWorkTracker();
  const handlers = installPressWorkHandlers(tracker);
  const scheduling = installPressWorkScheduling(tracker);
  add.call(window, "click", (event: Event) => tracker.capture(event, handlers.healthy() && scheduling.healthy() && handlers.covered(event)), true);
  for (const [kind, name] of Object.entries(PRESS_WORK_EVENTS)) add.call(window, name, (event: Event) => {
    const target = event.composedPath()[0];
    if (!target) return;
    if (kind === "mark") { tracker.arm(target);
      event.preventDefault(); }
    else if (kind === "release") tracker.release(target);
    else if (handlers.healthy() && scheduling.healthy()) {
      const state = tracker.state(target);
      if (kind === "observed" && state !== "unknown" || kind === "pending" && state === "pending") event.preventDefault();
    }
  }, true);
  return true;
}
