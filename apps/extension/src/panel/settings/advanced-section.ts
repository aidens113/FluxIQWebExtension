// "Advanced": the two addresses, the capture switches, Save, Disconnect and Forget
// this pairing, under a disclosure so the settings read top down by what a person
// cares about.
//
// It starts open. The Lab fills these labels the moment it opens Settings, and a
// control inside a closed disclosure is not visible to it (`shown()` checks
// `[hidden]` and client rects), so a closed start would stop the Lab. A person who
// closes it is remembered, per viewer, in `chrome.storage.local`; it opens again by
// itself when something inside needs them (a failure, unsaved changes).

import { createElement, type ElementChild } from "../dom";

export const ADVANCED_KEY = "fluxiq.ui.settingsAdvanced";
/** Whether Advanced is open for a viewer who never chose. */
export const ADVANCED_STARTS_OPEN = true;

export type AdvancedSection = {
  readonly element: HTMLElement;
  /** Opens it, as a failure or an unsaved change needs what is inside. Not remembered. */
  reveal(): void;
};

/** Builds the section around `children`. */
export function createAdvancedSection(children: readonly ElementChild[]): AdvancedSection {
  const summary = createElement("summary", { className: "settings-advanced-title", text: "Advanced" });
  const body = createElement("div", { className: "settings-advanced-body" }, children);
  const element = createElement("details", { className: "settings-group settings-advanced", attrs: { "aria-label": "Advanced" } }, [summary, body]);
  const details = element as HTMLDetailsElement;
  details.open = ADVANCED_STARTS_OPEN;
  let programmatic = false;
  let chosen = false;

  try {
    chrome.storage.local.get([ADVANCED_KEY], (items) => {
      if (chrome.runtime.lastError || chosen) return;
      if (items?.[ADVANCED_KEY] === "closed") {
        programmatic = true;
        details.open = false;
      }
    });
  } catch {
    /* best-effort: it simply starts as it does for everyone */
  }

  details.addEventListener("toggle", () => {
    if (programmatic) {
      programmatic = false;
      return;
    }
    chosen = true;
    try {
      chrome.storage.local.set({ [ADVANCED_KEY]: details.open ? "open" : "closed" }, () => void chrome.runtime.lastError);
    } catch {
      /* best-effort: a viewer convenience */
    }
  });

  return {
    element,
    reveal() {
      if (details.open) return;
      programmatic = true;
      details.open = true;
    }
  };
}
