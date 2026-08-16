"use strict";
(() => {
  // src/page/event-listener-tracker.ts
  var TRACKER_KEY = "__fluxiqWebAutomationEventListenerTrackerInstalled";
  var LISTENER_ATTRIBUTE = "data-fluxiq-event-listeners";
  var TRACKED_EVENT_TYPES = /* @__PURE__ */ new Set([
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
  var trackerWindow = window;
  if (!trackerWindow[TRACKER_KEY]) {
    trackerWindow[TRACKER_KEY] = true;
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function fluxiqTrackedAddEventListener(type, listener, options) {
      markEventTarget(this, type);
      return originalAddEventListener.call(this, type, listener, options);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", markInlineHandlers, { once: true });
    } else {
      markInlineHandlers();
    }
  }
  function markEventTarget(target, type) {
    if (!TRACKED_EVENT_TYPES.has(type) || !(target instanceof Element)) return;
    const existing = new Set((target.getAttribute(LISTENER_ATTRIBUTE) ?? "").split(/\s+/).filter(Boolean));
    existing.add(type);
    target.setAttribute(LISTENER_ATTRIBUTE, [...existing].sort().join(" "));
  }
  function markInlineHandlers() {
    for (const element of document.querySelectorAll("[onclick],[oninput],[onchange],[onsubmit],[onkeydown],[onkeyup],[onmousedown],[onmouseup],[onpointerdown]")) {
      for (const attribute of element.getAttributeNames()) {
        if (!attribute.startsWith("on")) continue;
        const type = attribute.slice(2);
        if (TRACKED_EVENT_TYPES.has(type)) markEventTarget(element, type);
      }
    }
  }
})();
//# sourceMappingURL=event-listener-tracker.js.map
