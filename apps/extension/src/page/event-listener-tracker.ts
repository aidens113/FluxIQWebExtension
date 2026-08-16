const TRACKER_KEY = "__fluxiqWebAutomationEventListenerTrackerInstalled";
const LISTENER_ATTRIBUTE = "data-fluxiq-event-listeners";
const TRACKED_EVENT_TYPES = new Set([
  "click",
  "pointerdown",
  "mousedown",
  "mouseup",
  "input",
  "change",
  "submit",
  "keydown",
  "keyup"
]);

type TrackerWindow = Window & { [TRACKER_KEY]?: boolean };

const trackerWindow = window as TrackerWindow;

if (!trackerWindow[TRACKER_KEY]) {
  trackerWindow[TRACKER_KEY] = true;
  const originalAddEventListener = EventTarget.prototype.addEventListener;

  EventTarget.prototype.addEventListener = function fluxiqTrackedAddEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    markEventTarget(this, type);
    return originalAddEventListener.call(this, type, listener, options);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", markInlineHandlers, { once: true });
  } else {
    markInlineHandlers();
  }
}

function markEventTarget(target: EventTarget, type: string): void {
  if (!TRACKED_EVENT_TYPES.has(type) || !(target instanceof Element)) return;
  const existing = new Set((target.getAttribute(LISTENER_ATTRIBUTE) ?? "").split(/\s+/).filter(Boolean));
  existing.add(type);
  target.setAttribute(LISTENER_ATTRIBUTE, [...existing].sort().join(" "));
}

function markInlineHandlers(): void {
  for (const element of document.querySelectorAll("[onclick],[oninput],[onchange],[onsubmit],[onkeydown],[onkeyup],[onmousedown],[onmouseup],[onpointerdown]")) {
    for (const attribute of element.getAttributeNames()) {
      if (!attribute.startsWith("on")) continue;
      const type = attribute.slice(2);
      if (TRACKED_EVENT_TYPES.has(type)) markEventTarget(element, type);
    }
  }
}
