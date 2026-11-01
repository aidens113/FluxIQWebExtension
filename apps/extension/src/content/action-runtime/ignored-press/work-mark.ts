import { PRESS_WORK_EVENTS } from "../../../shared/press-work-event";

/** A fresh supported-work observation of one click. Missing/unreadable observation is never idle. */
export function markPressWork(pressed: Pick<Element, "dispatchEvent">): { state(): "unknown" | "pending" | "idle"; stop(): void } | undefined {
  if (typeof CustomEvent !== "function" || typeof pressed.dispatchEvent !== "function") return undefined;
  const ask = (type: string): boolean => !pressed.dispatchEvent(new CustomEvent(type, { cancelable: true, composed: true }));
  if (!ask(PRESS_WORK_EVENTS.mark)) return undefined;
  let stopped = false;
  return {
    state: () => stopped || !ask(PRESS_WORK_EVENTS.observed) ? "unknown" : ask(PRESS_WORK_EVENTS.pending) ? "pending" : "idle",
    stop() { if (!stopped) { stopped = true;
      ask(PRESS_WORK_EVENTS.release); } }
  };
}
