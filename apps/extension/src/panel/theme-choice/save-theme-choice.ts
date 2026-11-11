import { THEME_CHOICE_KEY } from "./theme-choice-key";
import type { ThemeChoice } from "./theme-choice";

/** Stores the choice for this browser; best effort, it is a viewer convenience. */
export function saveThemeChoice(choice: ThemeChoice): void {
  try {
    chrome.storage.local.set({ [THEME_CHOICE_KEY]: choice }, () => void chrome.runtime.lastError);
  } catch {
    /* best-effort: the choice still applies this session */
  }
}
