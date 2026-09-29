// The viewer's last choice of view, remembered per viewer in
// `chrome.storage.local` (UI audit, section 4, "Switching"): the mode under
// `fluxiq.ui.mode` and the Advanced tab under `fluxiq.ui.advancedTab`. Simple is
// the default when nothing is stored. Every read and write is wrapped: storage
// that throws or is missing leaves the panel on Simple rather than broken.

import { ADVANCED_TABS, type AdvancedTab, type PanelRoute } from "./contracts";

export const MODE_KEY = "fluxiq.ui.mode";
export const ADVANCED_TAB_KEY = "fluxiq.ui.advancedTab";

const SIMPLE: PanelRoute = { mode: "simple" };

/** The route stored values describe; anything unrecognised reads as Simple, or as the Activity tab. */
export function routeFromStored(values: Readonly<Record<string, unknown>>): PanelRoute {
  if (values[MODE_KEY] !== "advanced") return SIMPLE;
  const tab = values[ADVANCED_TAB_KEY];
  return { mode: "advanced", tab: ADVANCED_TABS.includes(tab as AdvancedTab) ? tab as AdvancedTab : "activity" };
}

/** The stored route, or Simple when nothing is stored or storage fails. Never rejects. */
export function readRoutePreference(): Promise<PanelRoute> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([MODE_KEY, ADVANCED_TAB_KEY], (items) => {
        try {
          resolve(chrome.runtime.lastError ? SIMPLE : routeFromStored(items ?? {}));
        } catch {
          resolve(SIMPLE);
        }
      });
    } catch {
      resolve(SIMPLE);
    }
  });
}

/** Remembers `route`. Choosing Simple keeps the stored Advanced tab for next time. Never throws. */
export function writeRoutePreference(route: PanelRoute): void {
  const values: Record<string, string> = route.mode === "advanced"
    ? { [MODE_KEY]: "advanced", [ADVANCED_TAB_KEY]: route.tab }
    : { [MODE_KEY]: "simple" };
  try {
    chrome.storage.local.set(values, () => {
      void chrome.runtime.lastError;
    });
  } catch {
    /* best-effort: the remembered view is a viewer convenience, and the panel works the same without it */
  }
}
