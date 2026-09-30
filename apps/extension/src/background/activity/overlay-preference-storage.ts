// Where the person's overlay preference is kept. `chrome.storage.local`, not
// session storage, so it outlives a browser restart: it is how they want the
// page to look, not state about a run.

import type { ActivityOverlayPreference } from "../../shared/activity/index";
import { isActivityOverlayPreference } from "./is-activity-overlay-preference";

const STORAGE_KEY = "fluxiq.activity.overlay";

export const overlayPreferenceStorage = {
  async read(): Promise<ActivityOverlayPreference | undefined> {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const value: unknown = stored[STORAGE_KEY];
    return isActivityOverlayPreference(value) ? value : undefined;
  },
  async write(overlay: ActivityOverlayPreference): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: overlay });
  }
};
