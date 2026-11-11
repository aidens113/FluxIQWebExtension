import { applyThemeChoice } from "./apply-theme-choice";
import { DEFAULT_THEME_CHOICE } from "./default-theme-choice";
import { normaliseThemeChoice } from "./normalise-theme-choice";
import { readThemeChoice } from "./read-theme-choice";
import { THEME_CHOICE_KEY } from "./theme-choice-key";

/** Applies the default at once (so the first paint is the brand dark), then the stored choice, and follows later changes (another panel, the settings screen). */
export function mountThemeChoice(): void {
  applyThemeChoice(DEFAULT_THEME_CHOICE);
  void readThemeChoice().then((choice) => applyThemeChoice(choice));
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[THEME_CHOICE_KEY]) applyThemeChoice(normaliseThemeChoice(changes[THEME_CHOICE_KEY].newValue));
    });
  } catch {
    /* best-effort: no live following without storage events */
  }
}
