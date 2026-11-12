import { DEFAULT_THEME_CHOICE } from "./default-theme-choice";
import { normaliseThemeChoice } from "./normalise-theme-choice";
import { THEME_CHOICE_KEY } from "./theme-choice-key";
import type { ThemeChoice } from "./theme-choice";

/** The stored choice; the default when nothing is stored or storage cannot be read. */
export function readThemeChoice(): Promise<ThemeChoice> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([THEME_CHOICE_KEY], (items) => {
        if (chrome.runtime.lastError) resolve(DEFAULT_THEME_CHOICE);
        else resolve(normaliseThemeChoice(items?.[THEME_CHOICE_KEY]));
      });
    } catch {
      resolve(DEFAULT_THEME_CHOICE);
    }
  });
}
